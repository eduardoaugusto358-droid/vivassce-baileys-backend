# 🐳 Vivassce Baileys Backend - Docker + Portainer

Guia completo de instalação via **Portainer** com variáveis de ambiente personalizáveis.

---

## 📋 PRÉ-REQUISITOS

1. ✅ Docker instalado
2. ✅ Portainer instalado
3. ✅ Domínio configurado (opcional)

---

## 🚀 INSTALAÇÃO VIA PORTAINER

### **Método 1: Docker Compose (RECOMENDADO)**

#### 1. Acessar Portainer
```
https://seu-servidor:9443
```

#### 2. Ir em "Stacks" → "Add Stack"

#### 3. Dar nome ao stack
```
vivassce-baileys-backend
```

#### 4. Escolher "Repository" ou "Git Repository"

**Opção A - Repository:**
```
Repository URL: https://github.com/seu-usuario/vivassce-baileys-backend
Reference: refs/heads/main
Compose path: docker-compose.yml
```

**Opção B - Web Editor:**
- Copiar o conteúdo do `docker-compose.yml`
- Colar no editor

#### 5. Configurar Variáveis de Ambiente

Clicar em "Add an environment variable" e adicionar:

| Variável | Valor | Descrição |
|----------|-------|-----------|
| `PORT` | `3002` | Porta do servidor |
| `NODE_ENV` | `production` | Ambiente |
| `PUBLIC_URL` | `https://api.stackleys.iconverseagora.com` | URL pública |
| `ALLOWED_ORIGINS` | `https://baileys.iconverseagora.com,https://dev.iconverseagora.com` | Origens permitidas (CORS) |
| `ADMIN_USERNAME` | `admin` | Usuário admin |
| `ADMIN_PASSWORD` | `SuaSenhaForte123!` | Senha admin |
| `MAX_RECONNECT_ATTEMPTS` | `5` | Tentativas de reconexão |
| `LOG_LEVEL` | `info` | Nível de log |

#### 6. Deploy
Clicar em **"Deploy the stack"**

#### 7. Aguardar
- Portainer vai baixar a imagem
- Criar volumes
- Iniciar container

---

### **Método 2: Container Individual**

#### 1. Ir em "Containers" → "Add container"

#### 2. Configurações básicas
```
Name: vivassce-baileys-backend
Image: ghcr.io/seu-usuario/vivassce-baileys-backend:latest
```

#### 3. Network ports configuration
```
+publish a new network port
8080 (host) → 3002 (container)
```

#### 4. Volumes
```
/data → /data (container)
/baileys-auth → /app/baileys/auth (container)
```

#### 5. Environment variables
Adicionar todas as variáveis listadas acima

#### 6. Restart policy
```
Unless stopped
```

#### 7. Deploy container

---

## 🔧 CONFIGURAR NGINX (REVERSE PROXY)

Após container rodando, configurar Nginx:

```nginx
server {
    listen 80;
    server_name api.stackleys.iconverseagora.com;

    location / {
        proxy_pass http://localhost:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Ativar SSL:
```bash
sudo certbot --nginx -d api.stackleys.iconverseagora.com
```

---

## ✅ VERIFICAR INSTALAÇÃO

### 1. Logs do container
No Portainer:
- Ir em "Containers"
- Clicar em `vivassce-baileys-backend`
- Clicar em "Logs"

Deve aparecer:
```
🚀 Iniciando Vivassce Baileys Backend...
✅ Banco de dados inicializado
✅ Servidor iniciado com sucesso!
🌐 Local: http://localhost:3002
```

### 2. Testar API

**Via navegador:**
```
http://seu-servidor:3002/api/status
```

**Via curl:**
```bash
curl http://localhost:3002/api/status
```

Resposta esperada:
```json
{
  "status": "online",
  "service": "Baileys Backend",
  "stats": {
    "total": 0,
    "connected": 0,
    "disconnected": 0
  }
}
```

---

## 🔄 ATUALIZAR VIA PORTAINER

### Quando houver atualizações no GitHub:

#### Método 1: Pull and Redeploy
1. Ir em "Stacks"
2. Clicar no stack `vivassce-baileys-backend`
3. Clicar em "Pull and redeploy"
4. Aguardar

#### Método 2: Watchtower (AUTOMÁTICO)
Instalar Watchtower para atualizar automaticamente:

```yaml
version: '3.8'

services:
  watchtower:
    image: containrrr/watchtower
    container_name: watchtower
    restart: unless-stopped
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
    environment:
      - WATCHTOWER_CLEANUP=true
      - WATCHTOWER_POLL_INTERVAL=3600
      - WATCHTOWER_LABEL_ENABLE=true
```

Isso vai verificar atualizações a cada 1 hora e atualizar automaticamente.

---

## 📊 MONITORAMENTO NO PORTAINER

### Ver status:
1. Ir em "Containers"
2. Ver status: 🟢 running

### Ver recursos:
1. Clicar no container
2. Ver "Stats":
   - CPU usage
   - Memory usage
   - Network I/O

### Ver logs em tempo real:
1. Clicar no container
2. "Logs" → Auto-refresh ON

---

## 🗑️ REMOVER/REINSTALAR

### Remover stack:
1. Ir em "Stacks"
2. Clicar no stack
3. "Delete this stack"
4. Marcar "Remove associated volumes" (se quiser limpar tudo)

### Reinstalar:
- Seguir processo de instalação novamente
- Volumes serão recriados

---

## 🔐 VARIÁVEIS DE AMBIENTE IMPORTANTES

### Obrigatórias:
- ✅ `PUBLIC_URL` - URL pública do backend
- ✅ `ALLOWED_ORIGINS` - Origens permitidas (CORS)

### Recomendadas:
- ✅ `ADMIN_PASSWORD` - **SEMPRE MUDE!**
- ✅ `PORT` - Se quiser usar outra porta

### Opcionais:
- `MAX_RECONNECT_ATTEMPTS` - Tentativas de reconexão
- `LOG_LEVEL` - Nível de detalhes nos logs

---

## 🐛 TROUBLESHOOTING

### Container não inicia
```bash
# Ver logs
docker logs vivassce-baileys-backend

# Ver erros
docker logs vivassce-baileys-backend --tail 50
```

### Porta em uso
- Mudar variável `PORT` no stack
- Ou mudar mapeamento de porta no Portainer

### Banco de dados corrompido
```bash
# Parar container
docker stop vivassce-baileys-backend

# Remover volume do banco
docker volume rm vivassce-baileys-backend_baileys-data

# Iniciar novamente
docker start vivassce-baileys-backend
```

### Sessões Baileys corrompidas
```bash
# Remover volume de auth
docker volume rm vivassce-baileys-backend_baileys-auth
```

---

## 📦 BACKUP

### Backup manual:
```bash
# Backup do banco
docker cp vivassce-baileys-backend:/data/baileys.db ./baileys-backup.db

# Backup das sessões
docker cp vivassce-baileys-backend:/app/baileys/auth ./baileys-auth-backup
```

### Restaurar backup:
```bash
# Parar container
docker stop vivassce-baileys-backend

# Restaurar banco
docker cp ./baileys-backup.db vivassce-baileys-backend:/data/baileys.db

# Restaurar sessões
docker cp ./baileys-auth-backup/. vivassce-baileys-backend:/app/baileys/auth/

# Iniciar container
docker start vivassce-baileys-backend
```

---

## 🔗 LINKS ÚTEIS

- Repositório: https://github.com/seu-usuario/vivassce-baileys-backend
- Documentação Baileys: https://whiskeysockets.github.io/Baileys/
- Portainer Docs: https://docs.portainer.io/

---

## 📞 SUPORTE

Verificar:
1. ✅ Logs do container
2. ✅ Variáveis de ambiente
3. ✅ Portas abertas
4. ✅ Nginx configurado
5. ✅ SSL funcionando

---

## 📄 LICENÇA

MIT License - Vivassce 2025
