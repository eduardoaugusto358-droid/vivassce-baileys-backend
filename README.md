# 🚀 Vivassce Baileys Backend

Backend API REST para gerenciamento de múltiplas instâncias do WhatsApp usando Baileys.

## 📋 Funcionalidades

- ✅ Múltiplas instâncias simultâneas
- ✅ Suporte a proxies (SOCKS5, SOCKS4, HTTP, HTTPS)
- ✅ Envio de mensagens (texto, mídia, documento, áudio)
- ✅ Mention all (marcar todos do grupo)
- ✅ Link preview
- ✅ QR Code via API
- ✅ Autenticação por API Key
- ✅ Log de mensagens enviadas
- ✅ Reconexão automática

## 🔧 Instalação

### 1. Clonar/Copiar arquivos para o servidor

```bash
# SSH no servidor
ssh root@seu-servidor

# Criar pasta
mkdir /root/vivassce-baileys-backend
cd /root/vivassce-baileys-backend

# Copiar todos os arquivos para esta pasta
```

### 2. Instalar dependências

```bash
npm install
```

### 3. Configurar variáveis de ambiente

```bash
cp .env.example .env
nano .env
```

Editar conforme necessário:
```env
PORT=3002
DB_PATH=./baileys.db
NODE_ENV=production
PUBLIC_URL=https://api.stackleys.iconverseagora.com
```

### 4. Iniciar com PM2

```bash
# Instalar PM2 (se não tiver)
npm install -g pm2

# Iniciar aplicação
pm2 start server.js --name "vivassce-baileys"

# Salvar configuração
pm2 save

# Configurar auto-start
pm2 startup
```

### 5. Configurar Nginx (Reverse Proxy)

Criar arquivo `/etc/nginx/sites-available/baileys`:

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

Ativar:
```bash
sudo ln -s /etc/nginx/sites-available/baileys /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 6. Configurar SSL (Let's Encrypt)

```bash
sudo certbot --nginx -d api.stackleys.iconverseagora.com
```

## 📡 API Endpoints

### Gerenciamento de Instâncias

#### Criar Instância
```http
POST /api/instance/create

Body:
{
  "name": "Marketing",
  "proxyEnabled": true,
  "proxyType": "socks5",
  "proxyHost": "proxy.com",
  "proxyPort": 1080,
  "proxyUsername": "user",
  "proxyPassword": "pass"
}

Response:
{
  "success": true,
  "instanceId": "instance-1234567890",
  "apiKey": "baileys_abc123...",
  "status": "created"
}
```

#### Listar Instâncias
```http
GET /api/instance/list

Response:
{
  "success": true,
  "instances": [...],
  "total": 3
}
```

#### Conectar (Gerar QR Code)
```http
POST /api/instance/:id/connect

Response:
{
  "success": true,
  "qrCode": "data:image/png;base64,...",
  "status": "qr"
}
```

#### Ver QR Code
```http
GET /api/instance/:id/qr

Response:
{
  "success": true,
  "qrCode": "data:image/png;base64,...",
  "status": "qr"
}
```

#### Status da Instância
```http
GET /api/instance/:id/status

Response:
{
  "success": true,
  "status": "connected",
  "phone": "5537981552520"
}
```

#### Listar Grupos
```http
GET /api/instance/:id/groups

Response:
{
  "success": true,
  "groups": [
    {
      "id": "120363...@g.us",
      "name": "Grupo Teste",
      "participants": 50
    }
  ]
}
```

#### Desconectar
```http
POST /api/instance/:id/disconnect

Response:
{
  "success": true,
  "message": "Instância desconectada"
}
```

#### Deletar
```http
DELETE /api/instance/:id

Response:
{
  "success": true,
  "message": "Instância deletada"
}
```

### Envio de Mensagens

**Todas as rotas de envio requerem autenticação via API Key no header:**
```http
X-API-Key: baileys_abc123...
```

#### Enviar Texto
```http
POST /api/send/text

Headers:
  X-API-Key: baileys_abc123...

Body:
{
  "groupId": "120363123456789@g.us",
  "message": "Olá grupo!",
  "linkPreview": false,
  "mentions": []
}

Response:
{
  "success": true,
  "messageId": "ABC123..."
}
```

#### Enviar com Link Preview
```http
POST /api/send/text

Body:
{
  "groupId": "120363123456789@g.us",
  "message": "Confira: https://exemplo.com",
  "linkPreview": true
}
```

#### Enviar com Mention All
```http
POST /api/send/text

Body:
{
  "groupId": "120363123456789@g.us",
  "message": "Atenção a todos!",
  "mentions": ["*"]
}
```

#### Enviar Mídia
```http
POST /api/send/media

Body:
{
  "groupId": "120363123456789@g.us",
  "mediaUrl": "https://exemplo.com/imagem.jpg",
  "mediaType": "image",
  "caption": "Olha essa imagem!",
  "mentions": []
}
```

Tipos de mídia: `image`, `video`, `audio`

#### Enviar Documento
```http
POST /api/send/document

Body:
{
  "groupId": "120363123456789@g.us",
  "documentUrl": "https://exemplo.com/arquivo.pdf",
  "fileName": "documento.pdf",
  "caption": "Segue o arquivo",
  "mentions": []
}
```

#### Enviar Áudio
```http
POST /api/send/audio

Body:
{
  "groupId": "120363123456789@g.us",
  "audioUrl": "https://exemplo.com/audio.mp3",
  "ptt": true,
  "mentions": []
}
```

## 🔐 Tipos de Proxy Suportados

- **SOCKS5** (recomendado)
- **SOCKS4**
- **HTTP**
- **HTTPS**
- **SOCKS5-TLS** (com criptografia extra)

## 📊 Comandos PM2

```bash
# Ver processos
pm2 list

# Ver logs
pm2 logs vivassce-baileys

# Reiniciar
pm2 restart vivassce-baileys

# Parar
pm2 stop vivassce-baileys

# Monitorar
pm2 monit
```

## 🐛 Troubleshooting

### Porta já em uso
```bash
# Ver o que está usando a porta 3002
lsof -i :3002

# Matar processo
kill -9 PID
```

### Problemas com proxy
- Verificar se o proxy está funcionando
- Testar com outro tipo de proxy
- Desabilitar proxy temporariamente

### Instância não conecta
- Verificar logs: `pm2 logs vivassce-baileys`
- Tentar reconectar: `POST /api/instance/:id/connect`
- Deletar e criar nova instância

### Mensagens não enviam
- Verificar se instância está conectada
- Verificar formato do groupId (deve terminar com @g.us)
- Verificar logs de erro no banco: `baileys_messages_log`

## 📝 Logs

Logs são salvos automaticamente no banco de dados na tabela `baileys_messages_log`.

Para ver logs:
```bash
sqlite3 baileys.db "SELECT * FROM baileys_messages_log ORDER BY sent_at DESC LIMIT 20;"
```

## 🔄 Atualização

```bash
cd /root/vivassce-baileys-backend
git pull  # se estiver usando git
npm install
pm2 restart vivassce-baileys
```

## 📞 Suporte

Em caso de problemas, verificar:
1. Logs do PM2: `pm2 logs vivassce-baileys`
2. Status do Nginx: `sudo systemctl status nginx`
3. Banco de dados: `sqlite3 baileys.db ".tables"`
4. Processos: `pm2 list`

## 📄 Licença

MIT License - Vivassce 2025
