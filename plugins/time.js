module.exports = {
    name: 'Time',
    description: '回复包含"时间"的消息',
    help: {
        command: '>时间',
        usage: '查看当前时间'
    },
    handle: async (content, event, bot) => {
        console.log('Time插件收到消息:', content)
        if (typeof content === 'string' && content.includes('>时间')) {
            const now = new Date()
            return `现在是：${now.toLocaleString()}`
        }
        return null
    },
    handleGroup: async (content, event, bot) => {
        console.log('Time插件收到群消息:', content)
        if (typeof content === 'string' && content.includes('>时间')) {
            const now = new Date()
            return `@${event.sender.nickname} 现在是：${now.toLocaleString()}`
        }
        return null
    }
} 