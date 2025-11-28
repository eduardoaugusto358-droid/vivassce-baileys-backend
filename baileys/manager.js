// baileys/manager.js
const BaileysInstance = require('./instance')

class InstanceManager {
  constructor() {
    this.instances = new Map()
  }

  /**
   * Carrega instâncias do banco de dados ao iniciar
   */
  async loadFromDatabase(db) {
    try {
      const instances = db.prepare('SELECT * FROM baileys_instances').all()
      
      console.log(`📦 Carregando ${instances.length} instâncias do banco...`)
      
      for (const data of instances) {
        const proxyConfig = data.proxy_enabled ? {
          enabled: true,
          type: data.proxy_type,
          host: data.proxy_host,
          port: data.proxy_port,
          username: data.proxy_username,
          password: data.proxy_password
        } : null
        
        const instance = new BaileysInstance(
          data.id,
          data.api_key,
          data.name,      // ✅ ADICIONAR NAME
          proxyConfig
        )
        
        this.instances.set(data.id, instance)
        
        // Auto-conectar se estava conectado antes
        if (data.status === 'connected' || data.status === 'qr') {
          console.log(`🔄 Auto-conectando: ${data.id}`)
          await instance.connect(db)  // ✅ PASSAR DB
        }
      }
      
      console.log(`✅ ${instances.length} instâncias carregadas`)
      return instances.length
      
    } catch (error) {
      console.error('❌ Erro ao carregar instâncias:', error)
      return 0
    }
  }

  /**
   * Cria uma nova instância
   */
  create(id, apiKey, name, proxyConfig = null) {
    if (this.instances.has(id)) {
      throw new Error('Instância já existe')
    }
    
    const instance = new BaileysInstance(id, apiKey, name, proxyConfig)  // ✅ PASSAR NAME
    this.instances.set(id, instance)
    
    console.log(`➕ Instância criada: ${id}`)
    return instance
  }

  /**
   * Busca instância por ID
   */
  get(id) {
    return this.instances.get(id)
  }

  /**
   * Busca instância por API Key (precisa do DB)
   */
  getByApiKey(apiKey, db) {
    try {
      const data = db.prepare('SELECT * FROM baileys_instances WHERE api_key = ?').get(apiKey)
      if (!data) return null
      
      return this.instances.get(data.id)
    } catch (error) {
      console.error('Erro ao buscar instância por API Key:', error)
      return null
    }
  }

  /**
   * Lista todas as instâncias
   */
  getAll() {
    return Array.from(this.instances.values())
  }

  /**
   * Remove instância
   */
  delete(id) {
    const instance = this.instances.get(id)
    if (instance) {
      instance.disconnect()
      this.instances.delete(id)
      console.log(`🗑️ Instância removida: ${id}`)
      return true
    }
    return false
  }

  /**
   * Retorna estatísticas
   */
  getStats() {
    const instances = this.getAll()
    return {
      total: instances.length,
      connected: instances.filter(i => i.status === 'connected').length,
      disconnected: instances.filter(i => i.status === 'disconnected').length,
      qr: instances.filter(i => i.status === 'qr').length,
      error: instances.filter(i => i.status === 'error').length
    }
  }

  /**
   * Desconecta todas as instâncias
   */
  disconnectAll() {
    console.log('🔌 Desconectando todas as instâncias...')
    this.instances.forEach(instance => {
      instance.disconnect()
    })
    console.log('✅ Todas as instâncias desconectadas')
  }
}

// Singleton
const instanceManager = new InstanceManager()

module.exports = instanceManager
