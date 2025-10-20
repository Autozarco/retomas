# AUTO ZARCO - Sistema de Avaliação de Retomas

## Configuração Inicial

### 1. Criar o Primeiro Utilizador Administrador

Como o sistema agora usa Supabase para autenticação, você precisa criar o primeiro utilizador admin manualmente através do Supabase Dashboard:

1. Acesse o **Supabase Dashboard** em https://supabase.com/dashboard
2. Vá para o seu projeto
3. No menu lateral, clique em **Authentication** > **Users**
4. Clique em **Add user** > **Create new user**
5. Preencha:
   - **Email**: seu-email@exemplo.com
   - **Password**: sua-senha-segura
   - Marque "Auto Confirm User"
6. Clique em **Create user**

7. Agora você precisa criar o perfil do admin na tabela `profiles`:
   - Vá para **SQL Editor** no menu lateral
   - Execute este SQL (substitua o email pelo que você criou):

```sql
-- Primeiro, obtenha o ID do usuário
SELECT id, email FROM auth.users WHERE email = 'seu-email@exemplo.com';

-- Depois, crie o perfil admin (substitua 'user-id-aqui' pelo ID retornado acima)
INSERT INTO profiles (id, username, full_name, is_admin)
VALUES ('user-id-aqui', 'admin', 'Administrador', true);
```

### 2. Iniciar o Servidor

```bash
npm start
```

O servidor estará disponível em `http://localhost:3000`

### 3. Fazer Login

1. Acesse `http://localhost:3000`
2. Use o email e senha que você criou no Supabase
3. Você terá acesso completo ao sistema como administrador

### 4. Criar Outros Utilizadores

Após fazer login como admin:

1. Clique na aba **Utilizadores**
2. Clique em **Novo Utilizador**
3. Preencha os dados:
   - **Email**: email do utilizador
   - **Palavra-passe**: senha inicial
   - **Username**: nome de utilizador
   - **Nome Completo**: nome completo do utilizador
   - **Grupo**: selecione um dos grupos:
     - **Comercial**: Pode criar e gerenciar retomas
     - **Mecânica**: Pode visualizar e avaliar aspectos mecânicos
     - **Gerência**: Acesso total a todas as retomas e relatórios
   - **Administrador**: marque apenas se quiser dar permissões de admin

## Grupos e Permissões

### Comercial
- ✅ Criar novas retomas
- ✅ Ver retomas criadas por eles
- ✅ Editar retomas criadas por eles
- ✅ Preencher avaliação de carroçaria
- ✅ Definir valor da retoma

### Mecânica
- ✅ Ver todas as retomas
- ✅ Atualizar avaliação mecânica
- ✅ Adicionar observações técnicas
- ❌ Criar novas retomas
- ❌ Deletar retomas

### Gerência
- ✅ Acesso total a todas as retomas
- ✅ Ver relatórios e estatísticas
- ✅ Exportar dados (CSV/PDF)
- ✅ Aprovar ou rejeitar retomas
- ✅ Editar qualquer retoma
- ✅ Deletar retomas

### Administrador
- ✅ Todas as permissões acima
- ✅ Gerenciar utilizadores
- ✅ Criar/editar/deletar utilizadores
- ✅ Atribuir grupos e permissões

## Funcionalidades do Sistema

### Avaliação de Retomas

O formulário de avaliação inclui:

1. **Dados da Viatura**
   - Marca/Modelo
   - Quilometragem
   - Matrícula e data de matrícula
   - Combustível e cilindrada
   - Reserva de propriedade

2. **Dados do Cliente**
   - Nome, telefone, email
   - NIF
   - Interesse em veículo específico

3. **Avaliação de Carroçaria** (12 pontos de verificação)
   - Laterais, frente, trás
   - Vidros, tejadilho
   - Pintura, interiores
   - Cada item marcado como OK (verde) ou NOK (vermelho)

4. **Avaliação Mecânica** (15 pontos de verificação)
   - Motor, transmissão, escape
   - Travões, direção, suspensão
   - Componentes elétricos
   - Cada item marcado como OK (verde) ou NOK (vermelho)

5. **Mapa de Danos Interativo**
   - Clique no diagrama do veículo para marcar danos
   - Clique novamente nos pontos para remover
   - Visualização clara das áreas danificadas

6. **Dados da Retoma**
   - Valor proposto
   - Status (Pendente/Aprovado/Rejeitado)
   - Observações detalhadas

### Exportação de Dados

- **CSV**: Exporta tabela com todos os dados das retomas
- **PDF**: Gera relatório formatado em PDF

## Estrutura da Base de Dados

### Tabelas Principais

- `groups`: Grupos de utilizadores (Comercial, Mecânica, Gerência)
- `profiles`: Perfis dos utilizadores ligados ao auth.users
- `retomas`: Dados principais das avaliações
- `retoma_carrocaria`: Avaliação de carroçaria
- `retoma_mecanica`: Avaliação mecânica
- `retoma_damage_map`: Mapa de danos em formato JSON

## Suporte Técnico

Para questões técnicas ou problemas:
1. Verifique os logs do servidor
2. Verifique a consola do navegador
3. Confirme que as variáveis de ambiente do Supabase estão corretas no arquivo `.env`

## Segurança

- Todas as senhas são armazenadas de forma segura pelo Supabase
- Row Level Security (RLS) está ativo em todas as tabelas
- Utilizadores só podem ver dados permitidos pelo seu grupo
- Tokens de autenticação expiram após 8 horas
