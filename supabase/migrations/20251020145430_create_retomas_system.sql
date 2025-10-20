/*
  # Create Retomas Management System

  1. New Tables
    - `groups`
      - `id` (uuid, primary key)
      - `name` (text, unique) - Group name
      - `display_name` (text) - Display name (Comercial, Mecânica, Gerência)
      - `created_at` (timestamptz)
    
    - `profiles`
      - `id` (uuid, primary key, references auth.users)
      - `username` (text, unique)
      - `full_name` (text)
      - `group_id` (uuid, references groups)
      - `created_at` (timestamptz)
    
    - `retomas`
      - `id` (uuid, primary key)
      - Vehicle data: marca_modelo, quilometragem, matricula, data_matricula, combustivel, cilindrada, reserva_propriedade
      - Client data: cliente_nome, cliente_telefone, cliente_email, cliente_nif, interessado_em
      - `vendedor_id` (uuid, references profiles)
      - `valor_retoma` (numeric)
      - `observacoes` (text)
      - `status` (text) - pendente, aprovado, rejeitado
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `retoma_carrocaria`
      - `id` (uuid, primary key)
      - `retoma_id` (uuid, references retomas)
      - Individual fields for all 17 body checkpoints (lateral_esquerda, lateral_direita, etc.)
      - Each field is boolean (true=OK, false=NOK)
    
    - `retoma_mecanica`
      - `id` (uuid, primary key)
      - `retoma_id` (uuid, references retomas)
      - Individual fields for all 16 mechanical checkpoints
      - Each field is boolean (true=OK, false=NOK)
    
    - `retoma_damage_map`
      - `id` (uuid, primary key)
      - `retoma_id` (uuid, references retomas)
      - `damage_points` (jsonb) - Array of damage markers with positions
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Comercial: Can create and view retomas
    - Mecânica: Can view and update mechanical assessments
    - Gerência: Full access to all retomas and reports
    - Admin: Can manage users and groups
*/

-- Create groups table
CREATE TABLE IF NOT EXISTS groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  display_name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE groups ENABLE ROW LEVEL SECURITY;

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  username text UNIQUE NOT NULL,
  full_name text,
  group_id uuid REFERENCES groups ON DELETE SET NULL,
  is_admin boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Create retomas table
CREATE TABLE IF NOT EXISTS retomas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Vehicle data
  marca_modelo text NOT NULL,
  quilometragem integer,
  matricula text,
  data_matricula date,
  combustivel text,
  cilindrada text,
  reserva_propriedade boolean DEFAULT false,
  -- Client data
  cliente_nome text NOT NULL,
  cliente_telefone text,
  cliente_email text,
  cliente_nif text,
  interessado_em text,
  -- Retoma data
  vendedor_id uuid REFERENCES profiles ON DELETE SET NULL,
  valor_retoma numeric(10,2),
  observacoes text,
  status text DEFAULT 'pendente',
  -- Signatures
  chefe_oficina text,
  chefe_vendas text,
  -- Metadata
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE retomas ENABLE ROW LEVEL SECURITY;

-- Create retoma_carrocaria table
CREATE TABLE IF NOT EXISTS retoma_carrocaria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  retoma_id uuid REFERENCES retomas ON DELETE CASCADE NOT NULL,
  lateral_esquerda boolean DEFAULT true,
  lateral_direita boolean DEFAULT true,
  frente boolean DEFAULT true,
  para_brisas boolean DEFAULT true,
  tras boolean DEFAULT true,
  oculo_traseiro boolean DEFAULT true,
  tejadilho boolean DEFAULT true,
  pintura boolean DEFAULT true,
  painel_instrumentos boolean DEFAULT true,
  estofos boolean DEFAULT true,
  tapetes boolean DEFAULT true,
  guarnicoes boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE retoma_carrocaria ENABLE ROW LEVEL SECURITY;

-- Create retoma_mecanica table
CREATE TABLE IF NOT EXISTS retoma_mecanica (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  retoma_id uuid REFERENCES retomas ON DELETE CASCADE NOT NULL,
  motor boolean DEFAULT true,
  escape boolean DEFAULT true,
  transmissao boolean DEFAULT true,
  embraiagem boolean DEFAULT true,
  cx_velocidades boolean DEFAULT true,
  diferencial boolean DEFAULT true,
  cardans boolean DEFAULT true,
  bateria boolean DEFAULT true,
  direcao boolean DEFAULT true,
  travoes boolean DEFAULT true,
  amortecedores boolean DEFAULT true,
  jantes boolean DEFAULT true,
  pneus boolean DEFAULT true,
  farois boolean DEFAULT true,
  outras_luzes boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE retoma_mecanica ENABLE ROW LEVEL SECURITY;

-- Create damage map table
CREATE TABLE IF NOT EXISTS retoma_damage_map (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  retoma_id uuid REFERENCES retomas ON DELETE CASCADE NOT NULL,
  damage_points jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE retoma_damage_map ENABLE ROW LEVEL SECURITY;

-- Insert default groups
INSERT INTO groups (name, display_name) VALUES
  ('comercial', 'Comercial'),
  ('mecanica', 'Mecânica'),
  ('gerencia', 'Gerência')
ON CONFLICT (name) DO NOTHING;

-- RLS Policies for groups
CREATE POLICY "Anyone can view groups"
  ON groups FOR SELECT
  TO authenticated
  USING (true);

-- RLS Policies for profiles
CREATE POLICY "Users can view all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can insert profiles"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

CREATE POLICY "Admins can update all profiles"
  ON profiles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

CREATE POLICY "Admins can delete profiles"
  ON profiles FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- RLS Policies for retomas
CREATE POLICY "Users can view retomas in their group or all if gerencia"
  ON retomas FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND (
        p.is_admin = true
        OR EXISTS (
          SELECT 1 FROM groups g
          WHERE g.id = p.group_id AND g.name = 'gerencia'
        )
        OR p.group_id IN (
          SELECT group_id FROM profiles WHERE id = vendedor_id
        )
        OR vendedor_id = auth.uid()
      )
    )
  );

CREATE POLICY "Comercial can create retomas"
  ON retomas FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN groups g ON g.id = p.group_id
      WHERE p.id = auth.uid()
      AND (g.name = 'comercial' OR p.is_admin = true)
    )
  );

CREATE POLICY "Users can update retomas they created or if gerencia/admin"
  ON retomas FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND (
        p.is_admin = true
        OR vendedor_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM groups g
          WHERE g.id = p.group_id AND g.name IN ('gerencia', 'mecanica')
        )
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND (
        p.is_admin = true
        OR vendedor_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM groups g
          WHERE g.id = p.group_id AND g.name IN ('gerencia', 'mecanica')
        )
      )
    )
  );

-- RLS Policies for retoma_carrocaria
CREATE POLICY "Users can view carrocaria for retomas they can see"
  ON retoma_carrocaria FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM retomas r
      WHERE r.id = retoma_id
    )
  );

CREATE POLICY "Users can insert carrocaria for retomas they create"
  ON retoma_carrocaria FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM retomas r
      JOIN profiles p ON p.id = auth.uid()
      WHERE r.id = retoma_id
    )
  );

CREATE POLICY "Users can update carrocaria for retomas they can update"
  ON retoma_carrocaria FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM retomas r
      WHERE r.id = retoma_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM retomas r
      WHERE r.id = retoma_id
    )
  );

-- RLS Policies for retoma_mecanica (similar to carrocaria)
CREATE POLICY "Users can view mecanica for retomas they can see"
  ON retoma_mecanica FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM retomas r
      WHERE r.id = retoma_id
    )
  );

CREATE POLICY "Users can insert mecanica for retomas they create"
  ON retoma_mecanica FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM retomas r
      JOIN profiles p ON p.id = auth.uid()
      WHERE r.id = retoma_id
    )
  );

CREATE POLICY "Mecanica group can update mecanica assessments"
  ON retoma_mecanica FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN groups g ON g.id = p.group_id
      WHERE p.id = auth.uid()
      AND (g.name IN ('mecanica', 'gerencia') OR p.is_admin = true)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN groups g ON g.id = p.group_id
      WHERE p.id = auth.uid()
      AND (g.name IN ('mecanica', 'gerencia') OR p.is_admin = true)
    )
  );

-- RLS Policies for retoma_damage_map
CREATE POLICY "Users can view damage map for retomas they can see"
  ON retoma_damage_map FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM retomas r
      WHERE r.id = retoma_id
    )
  );

CREATE POLICY "Users can insert damage map for retomas they create"
  ON retoma_damage_map FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM retomas r
      JOIN profiles p ON p.id = auth.uid()
      WHERE r.id = retoma_id
    )
  );

CREATE POLICY "Users can update damage map for retomas they can update"
  ON retoma_damage_map FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM retomas r
      WHERE r.id = retoma_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM retomas r
      WHERE r.id = retoma_id
    )
  );

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for retomas
CREATE TRIGGER update_retomas_updated_at
  BEFORE UPDATE ON retomas
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
