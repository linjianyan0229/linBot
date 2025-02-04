const express = require('express')
const session = require('express-session')
const http = require('http')
const socketIO = require('socket.io')
const path = require('path')
const multer = require('multer')
const fs = require('fs')

class WebPanel {
    constructor(bot) {
        this.bot = bot
        this.app = express()
        this.server = http.createServer(this.app)
        this.io = socketIO(this.server)
        this.setupExpress()
        this.setupRoutes()
        this.setupWebSocket()
    }

    setupExpress() {
        // 设置模板引擎
        this.app.set('view engine', 'ejs')
        this.app.set('views', path.join(__dirname, 'views'))
        
        // 设置静态文件目录
        this.app.use(express.static(path.join(__dirname, 'public')))
        
        // 设置 session
        this.app.use(session({
            secret: 'qq-bot-secret',
            resave: false,
            saveUninitialized: true,
            cookie: { secure: false }
        }))

        // 解析请求体
        this.app.use(express.json())
        this.app.use(express.urlencoded({ extended: true }))
    }

    setupRoutes() {
        // 登录页面
        this.app.get('/login', (req, res) => {
            res.render('login')
        })

        // 处理登录
        this.app.post('/login', (req, res) => {
            const { password } = req.body
            if (password === process.env.ADMIN_PASSWORD) {
                req.session.isAdmin = true
                res.redirect('/')
            } else {
                res.render('login', { error: '密码错误' })
            }
        })

        // 中间件：检查是否登录
        const checkAuth = (req, res, next) => {
            if (req.session.isAdmin) {
                next()
            } else {
                res.redirect('/login')
            }
        }

        // 主页面
        this.app.get('/', checkAuth, (req, res) => {
            const botInfo = this.bot.botInfo || {
                qq: this.bot.client.uin,
                nickname: this.bot.client.nickname,
                online: this.bot.client.isOnline(),
                friends: this.bot.client.fl.size,
                loginDevice: 'MacOS'
            }

            res.render('dashboard', {
                botInfo,
                stats: {
                    uptime: process.uptime(),
                    memory: process.memoryUsage(),
                    friends: this.bot.client.fl.size,
                    lastUpdate: new Date().toLocaleString()
                }
            })
        })

        // API 路由
        this.app.get('/api/status', checkAuth, (req, res) => {
            res.json({
                online: this.bot.client.isOnline(),
                botInfo: this.bot.botInfo,
                stats: {
                    uptime: process.uptime(),
                    memory: process.memoryUsage(),
                    friends: this.bot.client.fl.size,
                    lastUpdate: new Date().toLocaleString()
                }
            })
        })

        // 获取好友列表
        this.app.get('/api/friends', checkAuth, (req, res) => {
            const friends = Array.from(this.bot.client.fl.values()).map(f => ({
                user_id: f.user_id,
                nickname: f.nickname,
                remark: f.remark
            }))
            res.json(friends)
        })

        // 发送消息
        this.app.post('/api/send', checkAuth, async (req, res) => {
            const { user_id, message } = req.body
            try {
                await this.bot.client.sendPrivateMsg(user_id, message)
                res.json({ success: true })
            } catch (error) {
                console.error('发送消息失败:', error)
                res.status(500).json({ 
                    success: false, 
                    error: error.message 
                })
            }
        })

        // 获取群列表
        this.app.get('/api/groups', checkAuth, async (req, res) => {
            try {
                // 直接从群管理器获取群列表
                const groups = this.bot.groupManager.getGroupList()
                res.json(groups)
            } catch (error) {
                console.error('获取群列表失败:', error)
                res.status(500).json({ error: '获取群列表失败' })
            }
        })

        // 启用群
        this.app.post('/api/group/enable/:id', checkAuth, async (req, res) => {
            try {
                if (!this.bot.groupManager) {
                    throw new Error('群管理器未初始化');
                }
                const success = await this.bot.groupManager.enableGroup(req.params.id);
                res.json({ success });
            } catch (error) {
                console.error('启用群失败:', error);
                res.status(500).json({ success: false, error: error.message });
            }
        });

        // 禁用群
        this.app.post('/api/group/disable/:id', checkAuth, async (req, res) => {
            try {
                if (!this.bot.groupManager) {
                    throw new Error('群管理器未初始化');
                }
                const success = await this.bot.groupManager.disableGroup(req.params.id);
                res.json({ success });
            } catch (error) {
                console.error('禁用群失败:', error);
                res.status(500).json({ success: false, error: error.message });
            }
        });

        // 登出
        this.app.get('/logout', (req, res) => {
            req.session.destroy()
            res.redirect('/login')
        })

        // 获取插件列表
        this.app.get('/api/plugins', checkAuth, (req, res) => {
            try {
                const plugins = this.bot.pluginManager.getPluginList()
                res.json(plugins)
            } catch (error) {
                console.error('获取插件列表失败:', error)
                res.status(500).json({ error: '获取插件列表失败' })
            }
        })

        // 自触发消息
        this.app.post('/api/send-message', checkAuth, async (req, res) => {
            try {
                const { type, target_id, message } = req.body
                const result = await this.bot.sendMessage(type, target_id, message)
                res.json(result)
            } catch (error) {
                console.error('发送消息失败:', error)
                res.status(500).json({ 
                    success: false, 
                    error: error.message 
                })
            }
        })

        // 获取日志
        this.app.get('/api/logs', checkAuth, (req, res) => {
            const limit = parseInt(req.query.limit) || 100
            const logs = this.bot.logManager.getLogs(limit)
            res.json(logs)
        })

        // 清除日志
        this.app.post('/api/logs/clear', checkAuth, (req, res) => {
            this.bot.logManager.clearLogs()
            res.json({ success: true })
        })

        // 启用插件
        this.app.post('/api/plugins/enable/:name', checkAuth, async (req, res) => {
            try {
                const success = await this.bot.pluginManager.enablePlugin(req.params.name)
                res.json({ success })
            } catch (error) {
                console.error('启用插件失败:', error)
                res.status(500).json({ success: false, error: error.message })
            }
        })

        // 禁用插件
        this.app.post('/api/plugins/disable/:name', checkAuth, async (req, res) => {
            try {
                const success = await this.bot.pluginManager.disablePlugin(req.params.name)
                res.json({ success })
            } catch (error) {
                console.error('禁用插件失败:', error)
                res.status(500).json({ success: false, error: error.message })
            }
        })

        // 修改文件上传配置
        const storage = multer.diskStorage({
            destination: function (req, file, cb) {
                const uploadDir = path.join(__dirname, '../../uploads');
                // 确保上传目录存在
                if (!fs.existsSync(uploadDir)) {
                    fs.mkdirSync(uploadDir, { recursive: true });
                }
                cb(null, uploadDir);
            },
            filename: function (req, file, cb) {
                // 生成更安全的文件名
                const ext = path.extname(file.originalname);
                const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
                cb(null, uniqueSuffix + ext);
            }
        });

        const upload = multer({
            storage: storage,
            limits: {
                fileSize: 5 * 1024 * 1024 // 限制5MB
            },
            fileFilter: function (req, file, cb) {
                // 只允许图片
                if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/)) {
                    return cb(new Error('只允许上传图片文件！'));
                }
                cb(null, true);
            }
        });

        // 修改上传路由
        this.app.post('/api/upload-image', checkAuth, upload.single('image'), (req, res) => {
            try {
                if (!req.file) {
                    return res.status(400).json({ error: '没有上传文件' });
                }
                
                // 返回完整的URL
                const imageUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
                res.json({ url: imageUrl });
            } catch (error) {
                console.error('处理图片上传失败:', error);
                res.status(500).json({ error: '上传失败' });
            }
        });

        // 添加静态文件服务
        this.app.use('/uploads', express.static(path.join(__dirname, '../../uploads')));
    }

    setupWebSocket() {
        this.io.on('connection', (socket) => {
            console.log('WebSocket 客户端已连接')

            // 发送实时状态更新
            const sendStatus = () => {
                socket.emit('status', {
                    online: this.bot.client.isOnline(),
                    botInfo: this.bot.botInfo,
                    stats: {
                        uptime: process.uptime(),
                        memory: process.memoryUsage(),
                        friends: this.bot.client.fl.size,
                        lastUpdate: new Date().toLocaleString()
                    }
                })
            }

            // 立即发送一次状态
            sendStatus()

            // 定期发送状态更新
            const statusInterval = setInterval(sendStatus, 5000)

            // 监听消息发送成功事件
            this.bot.client.on('message.send', (event) => {
                if (event.message_type === 'private') {
                    socket.emit('messageSent', {
                        success: true,
                        target_id: event.user_id,
                        message: event.message
                    });
                }
            });

            // 添加私聊消息监听
            this.bot.client.on('message.private', (event) => {
                socket.emit('privateMessage', {
                    sender_id: event.sender.user_id,
                    sender_name: event.sender.nickname,
                    message: event.message,
                    raw_message: event.raw_message
                })
            })

            socket.on('disconnect', () => {
                clearInterval(statusInterval)
                console.log('WebSocket 客户端已断开')
            })
        })

        // 监听日志事件
        this.bot.logManager.on('newLog', (log) => {
            this.io.emit('log', log)
        })

        this.bot.logManager.on('logsCleared', () => {
            this.io.emit('logsCleared')
        })
    }

    start(port = 3000) {
        this.server.listen(port, () => {
            console.log(`Web面板已启动: http://localhost:${port}`)
        })
    }
}

module.exports = WebPanel 