const fs = require('fs').promises
const path = require('path')

class PluginManager {
    constructor(bot) {
        this.bot = bot
        this.plugins = new Map()
        this.pluginDir = path.join(__dirname, '../../plugins')
        this.helpInfo = {
            private: [],  // 私聊帮助信息
            group: []     // 群聊帮助信息
        }
        this.configPath = path.join(__dirname, '../../data/plugins.json')
        this.enabledPlugins = new Set()  // 存储已启用的插件名称
    }

    async init() {
        try {
            // 确保插件目录存在
            await fs.mkdir(this.pluginDir, { recursive: true })
            
            // 加载插件配置
            await this.loadConfig()
            
            // 加载所有插件
            await this.loadPlugins()
            
            console.log('插件管理器初始化完成')
        } catch (error) {
            console.error('插件管理器初始化失败:', error)
        }
    }

    async loadConfig() {
        try {
            const data = await fs.readFile(this.configPath, 'utf8')
            const config = JSON.parse(data)
            this.enabledPlugins = new Set(config.enabledPlugins)
        } catch (error) {
            if (error.code !== 'ENOENT') {
                console.error('读取插件配置失败:', error)
            }
            // 如果文件不存在，默认所有插件启用
            this.enabledPlugins = new Set()
        }
    }

    async saveConfig() {
        try {
            const config = {
                enabledPlugins: Array.from(this.enabledPlugins)
            }
            await fs.writeFile(this.configPath, JSON.stringify(config, null, 2))
        } catch (error) {
            console.error('保存插件配置失败:', error)
        }
    }

    async loadPlugins() {
        try {
            // 清空现有帮助信息
            this.helpInfo.private = []
            this.helpInfo.group = []
            
            // 读取插件目录
            const files = await fs.readdir(this.pluginDir)
            const jsFiles = files.filter(file => file.endsWith('.js'))
            
            console.log('发现插件文件:', jsFiles)
            
            // 加载每个插件
            for (const file of jsFiles) {
                try {
                    const pluginPath = path.join(this.pluginDir, file)
                    const plugin = require(pluginPath)
                    
                    if (this.validatePlugin(plugin)) {
                        this.plugins.set(plugin.name, plugin)
                        
                        // 添加帮助信息
                        const helpText = plugin.help?.usage || plugin.description
                        const command = plugin.help?.command || `>${plugin.name.toLowerCase()}`
                        
                        if (plugin.handle) {
                            this.helpInfo.private.push(`${command} - ${helpText}`)
                        }
                        if (plugin.handleGroup) {
                            this.helpInfo.group.push(`${command} - ${helpText}`)
                        }
                        
                        console.log(`插件 ${plugin.name} 加载成功:`, {
                            hasHandle: typeof plugin.handle === 'function',
                            hasHandleGroup: typeof plugin.handleGroup === 'function',
                            helpInfo: helpText
                        })
                    } else {
                        console.error(`插件 ${file} 格式不正确，已跳过`)
                    }
                } catch (error) {
                    console.error(`加载插件 ${file} 失败:`, error)
                }
            }
            
            console.log('帮助信息已更新:', {
                private: this.helpInfo.private,
                group: this.helpInfo.group
            })
        } catch (error) {
            console.error('加载插件失败:', error)
        }
    }

    validatePlugin(plugin) {
        // 修改验证逻辑，添加帮助信息验证
        const isValid = (
            plugin &&
            typeof plugin.name === 'string' &&
            typeof plugin.description === 'string' &&
            (typeof plugin.handle === 'function' || typeof plugin.handleGroup === 'function') &&
            // 验证帮助信息
            (plugin.help === undefined || (
                typeof plugin.help === 'object' &&
                (!plugin.help.command || typeof plugin.help.command === 'string') &&
                (!plugin.help.usage || typeof plugin.help.usage === 'string')
            ))
        )

        if (!isValid) {
            console.error('插件验证失败:', {
                hasName: plugin && typeof plugin.name === 'string',
                hasDescription: plugin && typeof plugin.description === 'string',
                hasHandle: plugin && typeof plugin.handle === 'function',
                hasHandleGroup: plugin && typeof plugin.handleGroup === 'function',
                hasValidHelp: plugin && (!plugin.help || typeof plugin.help === 'object')
            })
        }

        return isValid
    }

    async handleMessage(event, content) {
        const isGroup = event.message_type === 'group'
        
        console.log(`处理${isGroup ? '群' : '私聊'}消息:`, content)
        
        // 遍历所有插件处理消息
        for (const plugin of this.plugins.values()) {
            try {
                // 检查插件是否启用
                if (!this.enabledPlugins.has(plugin.name)) {
                    console.log(`插件 ${plugin.name} 已禁用，跳过处理`)
                    continue
                }

                console.log(`尝试使用插件 ${plugin.name} 处理消息`)
                
                let response = null
                if (isGroup && plugin.handleGroup) {
                    response = await plugin.handleGroup(content, event, this.bot)
                } else if (!isGroup && plugin.handle) {
                    response = await plugin.handle(content, event, this.bot)
                }

                if (response) {
                    console.log(`插件 ${plugin.name} 处理成功，返回:`, response)
                    await event.reply(response)
                    return true
                }
            } catch (error) {
                console.error(`插件 ${plugin.name} 处理消息失败:`, error)
            }
        }
        
        return false
    }

    // 获取所有插件信息
    getPluginList() {
        return Array.from(this.plugins.values()).map(plugin => ({
            name: plugin.name,
            description: plugin.description,
            enabled: this.enabledPlugins.has(plugin.name)
        }))
    }

    // 获取帮助信息
    getHelpInfo(type = 'private') {
        return this.helpInfo[type]
    }

    // 启用插件
    async enablePlugin(name) {
        if (this.plugins.has(name)) {
            this.enabledPlugins.add(name)
            await this.saveConfig()
            console.log(`插件 ${name} 已启用`)
            return true
        }
        return false
    }

    // 禁用插件
    async disablePlugin(name) {
        if (this.plugins.has(name)) {
            this.enabledPlugins.delete(name)
            await this.saveConfig()
            console.log(`插件 ${name} 已禁用`)
            return true
        }
        return false
    }
}

module.exports = PluginManager 