module.exports = {
    name: 'Hello',
    description: '回复包含"你好"的消息',
    help: {
        command: '>你好',
        usage: '向机器人打招呼'
    },
    // 私聊消息处理
    handle: async (content, event, bot) => {
        console.log('Hello插件收到消息:', content)
        if (typeof content === 'string' && content.includes('>你好')) {
            return '你好！我是机器人，很高兴见到你！'
        }
        return null
    },
    // 群消息处理
    handleGroup: async (content, event, bot) => {
        console.log('Hello插件收到群消息:', content)
        if (typeof content === 'string' && content.includes('>你好')) {
            return `@${event.sender.nickname} 你好！我是机器人，很高兴见到你！`
        }
        return null
    }
} 