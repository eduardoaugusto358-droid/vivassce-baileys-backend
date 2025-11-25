// baileys/instance.js
const makeWASocket = require('@whiskeysockets/baileys').default
const { useMultiFileAuthState, DisconnectReason, getAggregateVotesInPollMessage } = require('@whiskeysockets/baileys')
const { Boom } = require('@hapi/boom')
const QRCode = require('qrcode')
const { SocksProxyAgent } = require('socks-proxy-agent')
const { HttpsProxyAgent } = require('https-proxy-agent')
const path = require('path')
const pino = require('pino')

class BaileysInstance {
  constructor(instanceId, apiKey, proxyConfig = null) {
    this.instanceId = instanceId
    this.apiKey = apiKey
    this.proxyConfig = proxyConfig
    this.sock = null
    this.status = 'disconnected'
    this.phone = null
    this.qrCode = null
    this.authPath = path.join(__dirname, 'auth', instanceId)
    this.reconnectAttempts = 0
    this.maxReconnectAttempts = 5
  }

  /**
   * Constrói a URL do proxy baseado na configuração
   */
  buildProxyUrl() {
    if (!this.proxyConfig || !this.proxyConfig.enabled) return null
    
    const { type, host, port, username, password } = this.proxyConfig
    
    // Mapeamento de protocolos
    const protocolMap = {
      'socks5': 'socks5',
      'socks4': 'socks4',
      'http': 'http',
      'https': 'https',
      'socks5-tls': 'socks5'
    }
    
    const protocol = protocolMap[type] || type
    
    // Construir URL
    let url = `${protocol}://`
    
    // Adicionar autenticação se houver
    if (username && password) {
      url += `${encodeURIComponent(username)}:${encodeURIComponent(password)}@`
    }
    
    url += `${host}:${port}`
    
    return url
  }

  /**
   * Cria o proxy agent baseado no tipo
   */
  createProxyAgent() {
    if (!this.proxyConfig || !this.proxyConfig.enabled) return undefined
    
    const proxyUrl = this.buildProxyUrl()
    if (!proxyUrl) return undefined
    
    try {
      const { type } = this.proxyConfig
      
      // SOCKS (4 ou 5)
      if (type === 'socks5' || type === 'socks4' || type === 'socks5-tls') {
        const options = {}
        
        // Se for SOCKS5 com TLS, adicionar opções SSL
        if (type === 'socks5-tls') {
          options.tls = {
            rejectUnauthorized: false
          }
        }
        
        return new SocksProxyAgent(proxyUrl, options)
      }
      
      // HTTP/HTTPS
      if (type === 'http' || type === 'https') {
        return new HttpsProxyAgent(proxyUrl)
      }
      
      console.warn('Tipo de proxy não suportado:', type)
      return undefined
      
    } catch (error) {
      console.error('Erro ao criar proxy agent:', error)
      return undefined
    }
  }

  /**
   * Conecta a instância ao WhatsApp
   */
  async connect() {
    try {
      const { state, saveCreds } = await useMultiFileAuthState(this.authPath)
      
      const agent = this.createProxyAgent()
      
      // Logger silencioso
      const logger = pino({ level: 'silent' })
      
      this.sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        browser: ['Vivassce', 'Chrome', '1.0.0'],
        agent: agent,
        logger: logger,
        markOnlineOnConnect: false
      })

      // Salvar credenciais quando atualizar
      this.sock.ev.on('creds.update', saveCreds)

      // Gerenciar atualizações de conexão
      this.sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update

        // QR Code gerado
        if (qr) {
          try {
            this.qrCode = await QRCode.toDataURL(qr)
            this.status = 'qr'
            console.log(`[${this.instanceId}] QR Code gerado`)
          } catch (error) {
            console.error(`[${this.instanceId}] Erro ao gerar QR Code:`, error)
          }
        }

        // Conexão fechada
        if (connection === 'close') {
          const statusCode = (lastDisconnect?.error)?.output?.statusCode
          const shouldReconnect = statusCode !== DisconnectReason.loggedOut

          console.log(`[${this.instanceId}] Conexão fechada:`, statusCode)

          if (shouldReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++
            console.log(`[${this.instanceId}] Tentando reconectar (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`)
            
            setTimeout(() => {
              this.connect()
            }, 5000)
          } else {
            this.status = 'disconnected'
            this.reconnectAttempts = 0
            
            if (statusCode === DisconnectReason.loggedOut) {
              console.log(`[${this.instanceId}] Deslogado - necessário novo QR Code`)
            }
          }
        }

        // Conexão aberta
        if (connection === 'open') {
          this.status = 'connected'
          this.phone = this.sock.user?.id.split(':')[0]
          this.reconnectAttempts = 0
          
          console.log(`✅ [${this.instanceId}] Conectado: +${this.phone}`)
          
          // Log do proxy usado
          if (this.proxyConfig?.enabled) {
            console.log(`🔒 [${this.instanceId}] Usando proxy ${this.proxyConfig.type}: ${this.proxyConfig.host}:${this.proxyConfig.port}`)
          }
        }
      })

      return true
    } catch (error) {
      console.error(`[${this.instanceId}] Erro ao conectar:`, error)
      this.status = 'error'
      return false
    }
  }

  /**
   * Busca metadata do grupo (com cache)
   */
  async getGroupMetadata(groupId) {
    if (!this.sock || this.status !== 'connected') {
      throw new Error('Instância não conectada')
    }

    return await this.sock.groupMetadata(groupId)
  }

  /**
   * Busca todos os participantes de um grupo
   */
  async getGroupParticipants(groupId) {
    const metadata = await this.getGroupMetadata(groupId)
    return metadata.participants.map(p => p.id)
  }

  /**
   * Envia mensagem de texto
   */
  async sendText(groupId, message, linkPreview = false, mentions = []) {
    if (!this.sock || this.status !== 'connected') {
      throw new Error('Instância não conectada')
    }

    // Se mentions contém "*", buscar todos os participantes
    if (mentions.includes('*')) {
      mentions = await this.getGroupParticipants(groupId)
    }

    const result = await this.sock.sendMessage(groupId, {
      text: message,
      mentions: mentions
    }, { 
      linkPreview: linkPreview 
    })

    return result
  }

  /**
   * Envia mídia (imagem, vídeo, áudio)
   */
  async sendMedia(groupId, mediaUrl, mediaType, caption = '', mentions = []) {
    if (!this.sock || this.status !== 'connected') {
      throw new Error('Instância não conectada')
    }

    // Se mentions contém "*", buscar todos os participantes
    if (mentions.includes('*')) {
      mentions = await this.getGroupParticipants(groupId)
    }

    const content = {
      [mediaType]: { url: mediaUrl },
      caption: caption,
      mentions: mentions
    }

    const result = await this.sock.sendMessage(groupId, content)
    return result
  }

  /**
   * Envia documento
   */
  async sendDocument(groupId, documentUrl, fileName, caption = '', mentions = []) {
    if (!this.sock || this.status !== 'connected') {
      throw new Error('Instância não conectada')
    }

    // Se mentions contém "*", buscar todos os participantes
    if (mentions.includes('*')) {
      mentions = await this.getGroupParticipants(groupId)
    }

    const result = await this.sock.sendMessage(groupId, {
      document: { url: documentUrl },
      fileName: fileName,
      caption: caption,
      mentions: mentions,
      mimetype: this.getMimeType(fileName)
    })

    return result
  }

  /**
   * Envia áudio
   */
  async sendAudio(groupId, audioUrl, ptt = true, mentions = []) {
    if (!this.sock || this.status !== 'connected') {
      throw new Error('Instância não conectada')
    }

    // Se mentions contém "*", buscar todos os participantes
    if (mentions.includes('*')) {
      mentions = await this.getGroupParticipants(groupId)
    }

    const result = await this.sock.sendMessage(groupId, {
      audio: { url: audioUrl },
      ptt: ptt,
      mimetype: 'audio/mp4',
      mentions: mentions
    })

    return result
  }

  /**
   * Lista todos os grupos da instância
   */
  async getAllGroups() {
    if (!this.sock || this.status !== 'connected') {
      throw new Error('Instância não conectada')
    }

    const groups = await this.sock.groupFetchAllParticipating()
    
    return Object.values(groups).map(g => ({
      id: g.id,
      name: g.subject,
      participants: g.participants.length,
      description: g.desc || '',
      createdAt: g.creation,
      isAdmin: g.participants.some(p => p.id === this.sock.user.id && p.admin)
    }))
  }

  /**
   * Retorna MIME type baseado na extensão do arquivo
   */
  getMimeType(fileName) {
    const ext = fileName.split('.').pop().toLowerCase()
    const mimeTypes = {
      'pdf': 'application/pdf',
      'doc': 'application/msword',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'xls': 'application/vnd.ms-excel',
      'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'zip': 'application/zip',
      'rar': 'application/x-rar-compressed',
      'txt': 'text/plain'
    }
    return mimeTypes[ext] || 'application/octet-stream'
  }

  /**
   * Desconecta a instância
   */
  disconnect() {
    if (this.sock) {
      this.sock.end()
      this.sock = null
      this.status = 'disconnected'
      console.log(`[${this.instanceId}] Desconectado`)
    }
  }

  /**
   * Retorna informações da instância
   */
  getInfo() {
    return {
      instanceId: this.instanceId,
      phone: this.phone,
      status: this.status,
      qrCode: this.qrCode,
      hasProxy: !!(this.proxyConfig?.enabled)
    }
  }
}

module.exports = BaileysInstance
