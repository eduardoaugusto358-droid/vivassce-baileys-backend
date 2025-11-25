// server.js
require('dotenv').config()
const express = require('express')
const cors = require('cors')
const Database = require('better-sqlite3')
const fs = require('fs')
const path = require('path')
const instanceManager = require('./baileys/manager')
const createRoutes = require('./baileys/routes')

// ============================================
// CONFIGURAÇÕES
// ============================================

const PORT = process.env.PORT || 3002
const DB_PATH = process.env.DB_PATH || './baileys.db'

// Origens permitidas (pode vir do .env separado por vírgula)
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : [
      'https://dev.iconverseagora.com',
      'https://api-dev.iconverseagora.com',
      'https://baileys.iconverseagora.com',
      'https://api.stackleys.iconverseagora.com',
      'http://localhost:5173',
      'http://localhost:3000',
      'http://localhost:3002'
    ]

// ============================================
// INICIALIZAÇÃO DO BANCO DE DADOS
// ============================================

let db

function initDatabase() {
  try {
    console.log('📦 Inicializando banco de dados...')
    
    db = new Database(DB_PATH)
    db.pragma('journal_mode = WAL')
    
    // Ler schema SQL
    const schemaPath = path.join(__dirname, 'schema.sql')
    const schema = fs.readFileSync(schemaPath, 'utf8')
    
    // Executar schema
    db.exec(schema)
    
    console.log('✅ Banco de dados inicializado')
    return db
  } catch (error) {
    console.error('❌ Erro ao inicializar banco de dados:', error)
    process.exit(1)
  }
}

// ============================================
// APLICAÇÃO EXPRESS
// ============================================

const app = express()

// Middleware CORS
app.use(cors({
  origin: (origin, callback) => {
    // Permitir requests sem origin (mobile apps, Postman, etc)
    if (!origin) return callback(null, true)
    
    if (ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true)
    } else {
      callback(new Error('Not allowed by CORS'))
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key']
}))

// Middleware para parsing JSON
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// Middleware de logging
app.use((req, res, next) => {
  const timestamp = new Date().toISOString()
  console.log(`[${timestamp}] ${req.method} ${req.path}`)
  next()
})

// ============================================
// ROTAS
// ============================================

// Rota raiz
app.get('/', (req, res) => {
  res.json({
    service: 'Vivassce Baileys Backend',
    version: '1.0.0',
    status: 'online',
    timestamp: new Date().toISOString(),
    endpoints: {
      status: '/api/status',
      instances: '/api/instance/*',
      send: '/api/send/*'
    }
  })
})

// Rotas da API
app.use('/api', createRoutes(db))

// Rota 404
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Rota não encontrada',
    path: req.path
  })
})

// Error handler
app.use((err, req, res, next) => {
  console.error('Erro não tratado:', err)
  res.status(500).json({ 
    error: 'Erro interno do servidor',
    message: err.message 
  })
})

// ============================================
// INICIALIZAÇÃO
// ============================================

async function start() {
  console.log('🚀 Iniciando Vivassce Baileys Backend...')
  console.log('')
  
  // 1. Inicializar banco
  db = initDatabase()
  
  // 2. Criar pasta de autenticação se não existir
  const authPath = path.join(__dirname, 'baileys', 'auth')
  if (!fs.existsSync(authPath)) {
    fs.mkdirSync(authPath, { recursive: true })
    console.log('📁 Pasta de autenticação criada')
  }
  
  // 3. Carregar instâncias do banco
  console.log('')
  await instanceManager.loadFromDatabase(db)
  
  // 4. Iniciar servidor
  console.log('')
  app.listen(PORT, () => {
    console.log('✅ Servidor iniciado com sucesso!')
    console.log('')
    console.log(`🌐 Local:      http://localhost:${PORT}`)
    console.log(`🌐 Produção:   https://api.stackleys.iconverseagora.com`)
    console.log('')
    console.log('📋 Endpoints disponíveis:')
    console.log(`   GET  /api/status`)
    console.log(`   POST /api/instance/create`)
    console.log(`   GET  /api/instance/list`)
    console.log(`   POST /api/instance/:id/connect`)
    console.log(`   POST /api/instance/:id/disconnect`)
    console.log(`   GET  /api/instance/:id/qr`)
    console.log(`   GET  /api/instance/:id/status`)
    console.log(`   GET  /api/instance/:id/groups`)
    console.log(`   DELETE /api/instance/:id`)
    console.log(`   POST /api/send/text`)
    console.log(`   POST /api/send/media`)
    console.log(`   POST /api/send/document`)
    console.log(`   POST /api/send/audio`)
    console.log('')
    
    const stats = instanceManager.getStats()
    console.log('📊 Estatísticas:')
    console.log(`   Total: ${stats.total}`)
    console.log(`   Conectadas: ${stats.connected}`)
    console.log(`   Desconectadas: ${stats.disconnected}`)
    console.log(`   Aguardando QR: ${stats.qr}`)
    console.log('')
  })
}

// ============================================
// GRACEFUL SHUTDOWN
// ============================================

function shutdown(signal) {
  console.log('')
  console.log(`🛑 Sinal ${signal} recebido. Encerrando...`)
  
  // Desconectar todas as instâncias
  instanceManager.disconnectAll()
  
  // Fechar banco de dados
  if (db) {
    db.close()
    console.log('🗄️ Banco de dados fechado')
  }
  
  console.log('✅ Servidor encerrado com sucesso')
  process.exit(0)
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))

// Capturar erros não tratados
process.on('uncaughtException', (error) => {
  console.error('❌ Erro não capturado:', error)
})

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Promise rejeitada não tratada:', reason)
})

// ============================================
// INICIAR
// ============================================

start().catch(error => {
  console.error('❌ Erro ao iniciar servidor:', error)
  process.exit(1)
})
