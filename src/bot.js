const { createClient } = require('icqq')
const readline = require('readline')
const GroupManager = require('./handlers/groupManager')
const PluginManager = require('./handlers/pluginManager')
const LogManager = require('./handlers/logManager')

class Bot {
    constructor(config) {
        this.config = config
        this.client = createClient(config)
        this.isLogging = false
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        })
        this.groupManager = new GroupManager(this.client)
        this.pluginManager = new PluginManager(this)
        this.logManager = new LogManager()
        this.startTime = new Date()
        this.dailyStats = {
            replyCount: 0,
            lastResetDate: new Date().toDateString(),
            dailyWord: ''
        }
        this.initDailyStats()
    }

    async init() {
        // 注册事件监听器
        this.client.on('message', this.handleMessage.bind(this))
        
        // 监听上线事件
        this.client.on('system.online', async () => {
            console.log('Bot已成功上线！')
            this.updateBotInfo()
            
            console.log('正在初始化群管理器...')
            try {
                // 等待一下确保群列表已加载
                await new Promise(resolve => setTimeout(resolve, 1000))
                
                console.log('群列表大小:', this.client.gl.size)
                console.log('群列表内容:', Array.from(this.client.gl.values()))
                
                await this.groupManager.init()
                this.groupManager.logGroupData()
                
                console.log('群管理器初始化完成')
                
                // 初始化插件管理器
                console.log('正在初始化插件管理器...')
                await this.pluginManager.init()
            } catch (error) {
                console.error('群管理器初始化失败:', error)
            }
        })

        // 监听滑动验证码事件
        this.client.on('system.login.slider', async (e) => {
            console.log('请访问以下链接并完成滑动验证码: ')
            console.log(e.url)
            this.rl.question('请输入ticket: ', (ticket) => {
                this.client.submitSlider(ticket.trim())
            })
        })

        // 监听设备锁验证事件
        this.client.on('system.login.device', async (e) => {
            console.log('收到设备锁验证请求...')
            this.rl.question('请选择验证方式 (1: 扫码验证, 2: 短信验证): ', async (choice) => {
                if (choice.trim() === '1') {
                    console.log('请使用手机QQ扫描设备锁验证码...')
                    await this.client.submitDeviceVerification()
                } else if (choice.trim() === '2') {
                    console.log('正在发送短信验证码...')
                    await this.client.sendSmsCode()
                    this.rl.question('请输入短信验证码: ', (code) => {
                        this.client.submitSmsCode(code.trim())
                    })
                }
            })
        })
    }

    async handleMessage(event) {
        try {
            // 处理私聊消息
            if (event.message_type === 'private') {
                const content = event.raw_message || event.message[0].text || event.message.toString()
                console.log('收到私聊消息:', content)

                // 处理命令
                if (content.startsWith('/')) {
                    await this.handleCommand(event)
                    return
                }

                // 使用插件处理消息
                const responses = await this.pluginManager.handleMessage(event, content)
                if (responses) {
                    if (Array.isArray(responses)) {
                        // 如果是多个回复
                        for (const response of responses) {
                            await event.reply(response)
                            this.dailyStats.replyCount++
                        }
                    } else {
                        // 单个回复
                        await event.reply(responses)
                        this.dailyStats.replyCount++
                    }
                    this.updateBotInfo()
                }
                return
            }

            // 处理群消息
            if (event.message_type === 'group') {
                if (!this.groupManager.isGroupEnabled(event.group_id)) {
                    console.log(`群 ${event.group_id} 已禁用，跳过消息处理`)
                    return
                }

                const content = event.raw_message || event.message[0].text || event.message.toString()
                console.log(`收到群 ${event.group_id} 消息:`, content)

                // 处理群命令
                if (content.startsWith('/')) {
                    await this.handleGroupCommand(event)
                    return
                }

                // 使用插件处理群消息
                const responses = await this.pluginManager.handleMessage(event, content)
                if (responses) {
                    if (Array.isArray(responses)) {
                        // 如果是多个回复
                        for (const response of responses) {
                            await event.reply(response)
                            this.dailyStats.replyCount++
                        }
                    } else {
                        // 单个回复
                        await event.reply(responses)
                        this.dailyStats.replyCount++
                    }
                    this.updateBotInfo()
                }
            }
        } catch (error) {
            console.error('处理消息出错:', error)
        }
    }

    async handleCommand(event) {
        const content = event.raw_message || event.message[0].text || event.message.toString()
        console.log('处理命令:', content)
        
        const [cmd, ...args] = content.slice(1).split(' ')

        switch (cmd.toLowerCase()) {
            case 'help':
                // 获取插件帮助信息
                const pluginHelp = this.pluginManager.getHelpInfo('private')
                
                await event.reply(
                    '可用命令:\n' +
                    '/help - 显示帮助\n' +
                    '/info - 显示机器人信息\n' +
                    '/ping - 测试机器人是否在线\n\n' +
                    '插件命令:\n' +
                    pluginHelp.join('\n')
                )
                break
            case 'info':
                await event.reply(this.getBotInfo())
                break
            case 'ping':
                await event.reply('pong!')
                break
            default:
                await event.reply('未知命令，输入 /help 查看帮助')
        }
    }

    async handleGroupCommand(event) {
        const content = event.raw_message || event.message[0].text || event.message.toString()
        console.log('处理群命令:', content)
        
        const [cmd, ...args] = content.slice(1).split(' ')

        switch (cmd.toLowerCase()) {
            case 'help':
                // 获取插件帮助信息
                const pluginHelp = this.pluginManager.getHelpInfo('group')
                
                await event.reply(
                    '群可用命令:\n' +
                    '/help - 显示帮助\n' +
                    '/info - 显示机器人信息\n' +
                    '/ping - 测试机器人是否在线\n\n' +
                    '插件命令:\n' +
                    pluginHelp.join('\n')
                )
                break
            case 'info':
                await event.reply(this.getBotInfo())
                break
            case 'ping':
                await event.reply('pong!')
                break
            default:
                await event.reply('未知命令，输入 /help 查看帮助')
        }
    }

    formatUptime() {
        const uptime = Math.floor((new Date() - this.startTime) / 1000)
        const days = Math.floor(uptime / 86400)
        const hours = Math.floor((uptime % 86400) / 3600)
        const minutes = Math.floor((uptime % 3600) / 60)
        const seconds = uptime % 60

        return `${days}天${hours}小时${minutes}分${seconds}秒`
    }

    updateBotInfo() {
        this.botInfo = {
            qq: this.client.uin,
            nickname: this.client.nickname,
            online: this.client.isOnline(),
            friends: this.client.fl.size,
            groups: this.client.gl.size,
            loginDevice: 'MacOS',
            uptime: this.formatUptime(),
            dailyReplyCount: this.dailyStats.replyCount,
            dailyWord: this.dailyStats.dailyWord
        }
    }

    getBotInfo() {
        return `机器人信息：
QQ: ${this.client.uin}
昵称: ${this.client.nickname}
在线状态: ${this.client.isOnline() ? '在线' : '离线'}
好友数量: ${this.client.fl.size}
群聊数量: ${this.client.gl.size}
登录设备: MacOS
运行时间: ${this.formatUptime()}
今日回复: ${this.dailyStats.replyCount}次
每日一言: ${this.dailyStats.dailyWord}`
    }

    async initDailyStats() {
        // 获取每日一言
        try {
            const response = await fetch('https://v1.hitokoto.cn')
            const data = await response.json()
            this.dailyStats.dailyWord = `${data.hitokoto} —— ${data.from}`
        } catch (error) {
            console.error('获取每日一言失败:', error)
            this.dailyStats.dailyWord = '今天也要开开心心的呀！'
        }

        // 设置每日重置定时器
        setInterval(() => {
            const today = new Date().toDateString()
            if (today !== this.dailyStats.lastResetDate) {
                this.resetDailyStats()
            }
        }, 60000) // 每分钟检查一次
    }

    resetDailyStats() {
        this.dailyStats.replyCount = 0
        this.dailyStats.lastResetDate = new Date().toDateString()
        // 重新获取每日一言
        this.initDailyStats()
    }

    async start() {
        await this.init()
        console.log('正在登录...')
        await this.client.login(this.config.uin, this.config.password)
    }

    async getGroupList() {
        try {
            const groups = await this.client.getGroupList();
            return groups.map(group => ({
                group_id: group.group_id,
                group_name: group.group_name,
                member_count: group.member_count
            }));
        } catch (error) {
            console.error('获取群列表失败:', error);
            return [];
        }
    }

    // 修改 sendMessage 方法来统计回复次数
    async sendMessage(type, target_id, message) {
        try {
            if (type === 'private') {
                // 处理图片消息
                if (Array.isArray(message) && message[0].type === 'image') {
                    await this.client.sendPrivateMsg(target_id, {
                        type: 'image',
                        file: message[0].file
                    });
                } else {
                    // 处理文本消息
                    await this.client.sendPrivateMsg(target_id, message);
                }
                this.dailyStats.replyCount++;
                this.updateBotInfo();
                return { success: true };
            } else if (type === 'group') {
                if (!this.groupManager.isGroupEnabled(target_id)) {
                    return { success: false, error: '该群已被禁用' };
                }
                // 处理图片消息
                if (Array.isArray(message) && message[0].type === 'image') {
                    await this.client.sendGroupMsg(target_id, {
                        type: 'image',
                        file: message[0].file
                    });
                } else {
                    // 处理文本消息
                    await this.client.sendGroupMsg(target_id, message);
                }
                this.dailyStats.replyCount++;
                this.updateBotInfo();
                return { success: true };
            }
            return { success: false, error: '不支持的消息类型' };
        } catch (error) {
            console.error('发送消息失败:', error);
            return { success: false, error: error.message };
        }
    }
}

module.exports = Bot 