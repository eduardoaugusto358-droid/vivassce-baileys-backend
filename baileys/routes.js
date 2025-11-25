// baileys/routes.js
const express = require('express')
const { v4: uuidv4 } = require('uuid')
const instanceManager = require('./manager')

function createRoutes(db) {
  const router = express.Router()

  // ============================================
  // MIDDLEWARE DE AUTENTICAÇÃO
  // ============================================
  
  const authenticateApiKey = (req, res, next) => {
    const apiKey = req.headers['x-api-key']
    
    if (!apiKey) {
      return res.status(401).json({ error: 'API Key não fornecida' })
    }
    
    const instance = instanceManager.getByApiKey(apiKey, db)
    
    if (!instance) {
      return res.status(403).json({ error: 'API Key inválida' })
    }
    
    if (instance.status !== 'connected') {
      return res.status(503).json({ 
        error: 'Instância não conectada',
        status: instance.status,
        message: instance.status === 'qr' 
          ? 'Aguardando leitura do QR Code' 
          : 'Instância desconectada'
      })
    }
    
    req.instance = instance
    
    // Buscar dados da instância do banco
    const instanceData = db.prepare('SELECT * FROM baileys_instances WHERE api_key = ?').get(apiKey)
    req.instanceData = instanceData
    
    next()
  }

  // ============================================
  // ROTAS PÚBLICAS (SEM AUTENTICAÇÃO)
  // ============================================

  // Status da API
  router.get('/status', (req, res) => {
    const stats = instanceManager.getStats()
    res.json({
      status: 'online',
      service: 'Baileys Backend',
      timestamp: new Date().toISOString(),
      stats: stats
    })
  })

  // Criar nova instância
  router.post('/instance/create', async (req, res) => {
    try {
      const { 
        name, 
        proxyEnabled,
        proxyType,
        proxyHost,
        proxyPort,
        proxyUsername,
        proxyPassword
      } = req.body

      // Validação
      if (!name) {
        return res.status(400).json({ error: 'Nome é obrigatório' })
      }

      if (proxyEnabled) {
        if (!proxyType || !proxyHost || !proxyPort) {
          return res.status(400).json({ 
            error: 'Quando proxy está habilitado, tipo, host e porta são obrigatórios' 
          })
        }
        
        const validTypes = ['socks5', 'socks4', 'http', 'https', 'socks5-tls']
        if (!validTypes.includes(proxyType)) {
          return res.status(400).json({ 
            error: `Tipo de proxy inválido. Tipos válidos: ${validTypes.join(', ')}` 
          })
        }
      }

      const instanceId = `instance-${Date.now()}`
      const apiKey = `baileys_${uuidv4()}`

      // Salvar no banco
      db.prepare(`
        INSERT INTO baileys_instances 
        (id, name, api_key, proxy_enabled, proxy_type, proxy_host, proxy_port, proxy_username, proxy_password)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        instanceId, 
        name, 
        apiKey, 
        proxyEnabled ? 1 : 0,
        proxyType || null,
        proxyHost || null,
        proxyPort || null,
        proxyUsername || null,
        proxyPassword || null
      )

      // Criar instância
      const proxyConfig = proxyEnabled ? {
        enabled: true,
        type: proxyType,
        host: proxyHost,
        port: proxyPort,
        username: proxyUsername,
        password: proxyPassword
      } : null

      const instance = instanceManager.create(instanceId, apiKey, name, proxyConfig)

      res.json({
        success: true,
        instanceId: instanceId,
        name: name,
        apiKey: apiKey,
        proxy: proxyEnabled ? {
          type: proxyType,
          host: proxyHost,
          port: proxyPort,
          hasAuth: !!(proxyUsername && proxyPassword)
        } : null,
        status: 'created',
        message: 'Instância criada com sucesso. Use o endpoint /instance/:id/connect para gerar QR Code'
      })

    } catch (error) {
      console.error('Erro ao criar instância:', error)
      res.status(500).json({ error: error.message })
    }
  })

  // Listar todas as instâncias
  router.get('/instance/list', (req, res) => {
    try {
      const instances = db.prepare('SELECT * FROM baileys_instances ORDER BY created_at DESC').all()
      
      const result = instances.map(inst => {
        const instance = instanceManager.get(inst.id)
        
        return {
          id: inst.id,
          name: inst.name,
          phone: inst.phone,
          status: instance ? instance.status : 'offline',
          qrCode: instance?.qrCode || null,
          proxy: inst.proxy_enabled ? {
            type: inst.proxy_type,
            host: inst.proxy_host,
            port: inst.proxy_port,
            hasAuth: !!(inst.proxy_username && inst.proxy_password)
          } : null,
          createdAt: inst.created_at
        }
      })

      res.json({
        success: true,
        instances: result,
        total: result.length
      })

    } catch (error) {
      console.error('Erro ao listar instâncias:', error)
      res.status(500).json({ error: error.message })
    }
  })

  // Conectar instância (gera QR Code)
  router.post('/instance/:id/connect', async (req, res) => {
    try {
      const { id } = req.params
      
      const instance = instanceManager.get(id)
      if (!instance) {
        return res.status(404).json({ error: 'Instância não encontrada' })
      }

      if (instance.status === 'connected') {
        return res.json({ 
          success: true,
          message: 'Instância já está conectada',
          status: 'connected',
          phone: instance.phone
        })
      }

      await instance.connect()

      // Aguardar QR Code ou conexão (timeout 10s)
      let attempts = 0
      while (attempts < 20 && instance.status !== 'qr' && instance.status !== 'connected') {
        await new Promise(resolve => setTimeout(resolve, 500))
        attempts++
      }

      res.json({
        success: true,
        instanceId: id,
        status: instance.status,
        qrCode: instance.qrCode,
        phone: instance.phone,
        message: instance.status === 'qr' 
          ? 'QR Code gerado. Escaneie com WhatsApp' 
          : instance.status === 'connected'
          ? 'Conectado com sucesso'
          : 'Aguardando conexão...'
      })

    } catch (error) {
      console.error('Erro ao conectar instância:', error)
      res.status(500).json({ error: error.message })
    }
  })

  // Desconectar instância
  router.post('/instance/:id/disconnect', (req, res) => {
    try {
      const { id } = req.params
      
      const instance = instanceManager.get(id)
      if (!instance) {
        return res.status(404).json({ error: 'Instância não encontrada' })
      }

      instance.disconnect()

      // Atualizar status no banco
      db.prepare('UPDATE baileys_instances SET status = ? WHERE id = ?')
        .run('disconnected', id)

      res.json({
        success: true,
        message: 'Instância desconectada com sucesso'
      })

    } catch (error) {
      console.error('Erro ao desconectar instância:', error)
      res.status(500).json({ error: error.message })
    }
  })

  // Pegar QR Code
  router.get('/instance/:id/qr', (req, res) => {
    try {
      const { id } = req.params
      
      const instance = instanceManager.get(id)
      if (!instance) {
        return res.status(404).json({ error: 'Instância não encontrada' })
      }

      if (!instance.qrCode) {
        return res.status(404).json({ 
          error: 'QR Code não disponível',
          status: instance.status,
          message: instance.status === 'connected' 
            ? 'Instância já está conectada' 
            : 'Use /instance/:id/connect para gerar QR Code'
        })
      }

      res.json({
        success: true,
        qrCode: instance.qrCode,
        status: instance.status
      })

    } catch (error) {
      console.error('Erro ao buscar QR Code:', error)
      res.status(500).json({ error: error.message })
    }
  })

  // Status da instância
  router.get('/instance/:id/status', (req, res) => {
    try {
      const { id } = req.params
      
      const instance = instanceManager.get(id)
      if (!instance) {
        return res.status(404).json({ error: 'Instância não encontrada' })
      }

      res.json({
        success: true,
        instanceId: id,
        status: instance.status,
        phone: instance.phone,
        qrCode: instance.qrCode
      })

    } catch (error) {
      console.error('Erro ao buscar status:', error)
      res.status(500).json({ error: error.message })
    }
  })

  // Listar grupos da instância
  router.get('/instance/:id/groups', async (req, res) => {
    try {
      const { id } = req.params
      
      const instance = instanceManager.get(id)
      if (!instance) {
        return res.status(404).json({ error: 'Instância não encontrada' })
      }

      if (instance.status !== 'connected') {
        return res.status(503).json({ 
          error: 'Instância não conectada',
          status: instance.status
        })
      }

      const groups = await instance.getAllGroups()

      res.json({
        success: true,
        groups: groups,
        total: groups.length
      })

    } catch (error) {
      console.error('Erro ao listar grupos:', error)
      res.status(500).json({ error: error.message })
    }
  })

  // Deletar instância
  router.delete('/instance/:id', (req, res) => {
    try {
      const { id } = req.params
      
      // Remover do gerenciador
      const removed = instanceManager.delete(id)
      
      if (!removed) {
        return res.status(404).json({ error: 'Instância não encontrada' })
      }

      // Remover do banco
      db.prepare('DELETE FROM baileys_instances WHERE id = ?').run(id)
      db.prepare('DELETE FROM baileys_messages_log WHERE instance_id = ?').run(id)

      res.json({
        success: true,
        message: 'Instância deletada com sucesso'
      })

    } catch (error) {
      console.error('Erro ao deletar instância:', error)
      res.status(500).json({ error: error.message })
    }
  })

  // ============================================
  // ROTAS DE ENVIO (COM AUTENTICAÇÃO)
  // ============================================

  // Enviar texto
  router.post('/send/text', authenticateApiKey, async (req, res) => {
    try {
      const { groupId, message, linkPreview, mentions } = req.body

      // Validação
      if (!groupId || !message) {
        return res.status(400).json({ 
          error: 'groupId e message são obrigatórios' 
        })
      }

      // Validar formato do groupId
      if (!groupId.endsWith('@g.us')) {
        return res.status(400).json({ 
          error: 'groupId inválido. Deve terminar com @g.us' 
        })
      }

      const result = await req.instance.sendText(
        groupId,
        message,
        linkPreview || false,
        mentions || []
      )

      // Salvar log
      db.prepare(`
        INSERT INTO baileys_messages_log 
        (instance_id, group_id, message_type, message_content, has_mentions, status)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        req.instanceData.id,
        groupId,
        'text',
        message,
        (mentions && mentions.length > 0) ? 1 : 0,
        'sent'
      )

      res.json({
        success: true,
        messageId: result.key.id,
        timestamp: result.messageTimestamp
      })

    } catch (error) {
      console.error('Erro ao enviar texto:', error)
      
      // Salvar log de erro
      try {
        db.prepare(`
          INSERT INTO baileys_messages_log 
          (instance_id, group_id, message_type, message_content, status, error)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(
          req.instanceData.id,
          req.body.groupId,
          'text',
          req.body.message,
          'error',
          error.message
        )
      } catch (logError) {
        console.error('Erro ao salvar log:', logError)
      }

      res.status(500).json({ error: error.message })
    }
  })

  // Enviar mídia
  router.post('/send/media', authenticateApiKey, async (req, res) => {
    try {
      const { groupId, mediaUrl, mediaType, caption, mentions } = req.body

      // Validação
      if (!groupId || !mediaUrl || !mediaType) {
        return res.status(400).json({ 
          error: 'groupId, mediaUrl e mediaType são obrigatórios' 
        })
      }

      const validTypes = ['image', 'video', 'audio']
      if (!validTypes.includes(mediaType)) {
        return res.status(400).json({ 
          error: `mediaType inválido. Tipos válidos: ${validTypes.join(', ')}` 
        })
      }

      const result = await req.instance.sendMedia(
        groupId,
        mediaUrl,
        mediaType,
        caption || '',
        mentions || []
      )

      // Salvar log
      db.prepare(`
        INSERT INTO baileys_messages_log 
        (instance_id, group_id, message_type, message_content, has_mentions, status)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        req.instanceData.id,
        groupId,
        mediaType,
        mediaUrl,
        (mentions && mentions.length > 0) ? 1 : 0,
        'sent'
      )

      res.json({
        success: true,
        messageId: result.key.id,
        timestamp: result.messageTimestamp
      })

    } catch (error) {
      console.error('Erro ao enviar mídia:', error)
      res.status(500).json({ error: error.message })
    }
  })

  // Enviar documento
  router.post('/send/document', authenticateApiKey, async (req, res) => {
    try {
      const { groupId, documentUrl, fileName, caption, mentions } = req.body

      // Validação
      if (!groupId || !documentUrl || !fileName) {
        return res.status(400).json({ 
          error: 'groupId, documentUrl e fileName são obrigatórios' 
        })
      }

      const result = await req.instance.sendDocument(
        groupId,
        documentUrl,
        fileName,
        caption || '',
        mentions || []
      )

      // Salvar log
      db.prepare(`
        INSERT INTO baileys_messages_log 
        (instance_id, group_id, message_type, message_content, has_mentions, status)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        req.instanceData.id,
        groupId,
        'document',
        documentUrl,
        (mentions && mentions.length > 0) ? 1 : 0,
        'sent'
      )

      res.json({
        success: true,
        messageId: result.key.id,
        timestamp: result.messageTimestamp
      })

    } catch (error) {
      console.error('Erro ao enviar documento:', error)
      res.status(500).json({ error: error.message })
    }
  })

  // Enviar áudio
  router.post('/send/audio', authenticateApiKey, async (req, res) => {
    try {
      const { groupId, audioUrl, ptt, mentions } = req.body

      // Validação
      if (!groupId || !audioUrl) {
        return res.status(400).json({ 
          error: 'groupId e audioUrl são obrigatórios' 
        })
      }

      const result = await req.instance.sendAudio(
        groupId,
        audioUrl,
        ptt !== false, // default true
        mentions || []
      )

      // Salvar log
      db.prepare(`
        INSERT INTO baileys_messages_log 
        (instance_id, group_id, message_type, message_content, has_mentions, status)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        req.instanceData.id,
        groupId,
        'audio',
        audioUrl,
        (mentions && mentions.length > 0) ? 1 : 0,
        'sent'
      )

      res.json({
        success: true,
        messageId: result.key.id,
        timestamp: result.messageTimestamp
      })

    } catch (error) {
      console.error('Erro ao enviar áudio:', error)
      res.status(500).json({ error: error.message })
    }
  })

  return router
}

module.exports = createRoutes
