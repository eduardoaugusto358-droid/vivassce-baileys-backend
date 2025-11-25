# ⚡ Setup Rápido - 5 Minutos

## 🎯 OBJETIVO
Instalar Vivassce Baileys Backend via Portainer em 5 minutos.

---

## ✅ PRÉ-REQUISITOS
- [ ] Docker instalado
- [ ] Portainer rodando
- [ ] Acesso SSH ao servidor

---

## 🚀 PASSO A PASSO

### 1️⃣ SUBIR NO GITHUB (1 min)

```bash
# No seu computador
cd vivassce-baileys-backend
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/vivassce-baileys-backend.git
git push -u origin main
```

---

### 2️⃣ PORTAINER - CRIAR STACK (2 min)

1. Acessar: `https://seu-servidor:9443`
2. Ir em: **Stacks** → **Add Stack**
3. Nome: `vivassce-baileys`
4. Build method: **Repository**
5. Repository URL: `https://github.com/SEU-USUARIO/vivassce-baileys-backend`
6. Reference: `refs/heads/main`
7. Compose path: `docker-compose.yml`

---

### 3️⃣ CONFIGURAR VARIÁVEIS (1 min)

Adicionar variáveis de ambiente:

```env
PORT=3002
NODE_ENV=production
PUBLIC_URL=https://api.stackleys.iconverseagora.com
ALLOWED_ORIGINS=https://baileys.iconverseagora.com,https://dev.iconverseagora.com
ADMIN_USERNAME=admin
ADMIN_PASSWORD=MudeIssoAgora123!
```

---

### 4️⃣ DEPLOY (30 seg)

1. Clicar em **"Deploy the stack"**
2. Aguardar download e inicialização
3. Ver logs: **Containers** → **vivassce-baileys-backend** → **Logs**

---

### 5️⃣ TESTAR (30 seg)

```bash
curl http://localhost:3002/api/status
```

Deve retornar:
```json
{
  "status": "online",
  "service": "Baileys Backend"
}
```

---

## ✅ PRONTO!

Backend rodando em:
- Local: `http://localhost:3002`
- Depois configurar Nginx para: `https://api.stackleys.iconverseagora.com`

---

## 🔄 ATUALIZAR (FUTURO)

1. Fazer push no GitHub
2. Portainer → Stack → **Pull and redeploy**
3. Pronto! ✅

---

## 📚 PRÓXIMOS PASSOS

1. [ ] Configurar Nginx reverse proxy
2. [ ] Configurar SSL com Certbot
3. [ ] Criar primeira instância
4. [ ] Testar envio de mensagem

Ver documentação completa em: `README.PORTAINER.md`
