const Bot = require('./bot')
const WebPanel = require('./web/server')
const config = require('../config/config')
const fs = require('fs').promises
const path = require('path')

async function ensureDirectories() {
    // 确保必要的目录存在
    const dirs = [
        './data',
        './src/web/public',
        './src/web/views'
    ]

    for (const dir of dirs) {
        try {
            await fs.mkdir(path.resolve(dir), { recursive: true })
        } catch (error) {
            if (error.code !== 'EEXIST') {
                console.error(`创建目录失败 ${dir}:`, error)
                throw error
            }
        }
    }
}

async function main() {
    try {
        // 确保必要的目录存在
        await ensureDirectories()

        // 检查环境变量
        const requiredEnvVars = ['QQ_ACCOUNT', 'QQ_PASSWORD', 'ADMIN_PASSWORD']
        for (const envVar of requiredEnvVars) {
            if (!process.env[envVar]) {
                throw new Error(`缺少必要的环境变量: ${envVar}`)
            }
        }

        console.log('正在启动QQ机器人...')
        
        // 创建并启动机器人
        const bot = new Bot(config)
        await bot.start()

        console.log('正在启动Web管理面板...')
        
        // 创建并启动Web面板
        const webPanel = new WebPanel(bot)
        webPanel.start(process.env.WEB_PORT || 3000)

        // 处理进程退出
        process.on('SIGINT', async () => {
            console.log('正在关闭程序...')
            try {
                // 这里可以添加清理工作
                process.exit(0)
            } catch (error) {
                console.error('关闭程序时出错:', error)
                process.exit(1)
            }
        })

    } catch (error) {
        console.error('程序启动失败:', error)
        process.exit(1)
    }
}

// 启动程序
main().catch(error => {
    console.error('程序运行出错:', error)
    process.exit(1)
}) 