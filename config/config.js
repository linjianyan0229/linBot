require('dotenv').config()

module.exports = {
    // QQ账号配置从环境变量中读取
    uin: parseInt(process.env.QQ_ACCOUNT),
    password: process.env.QQ_PASSWORD,
    
    // 使用 MacOS 协议
    platform: 4,

    // 日志等级
    log_level: 'info',
    
    // 数据目录
    data_dir: process.env.DATA_DIR || './data',
    
    // 自动重新登录
    auto_relogin: true,
    
    // 忽略自己发送的消息
    ignore_self: true,

    // 心跳间隔
    heartbeat_interval: 120000,

    // 机器人配置
    bot: {
        // 只开启私聊
        enablePrivate: true,
        enableGroup: false,
        // 随机回复概率
        replyChance: 0.3,
        // 管理员QQ号列表
        admins: [process.env.ADMIN_QQ || '']
    }
} 