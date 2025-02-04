const EventEmitter = require('events')

class LogManager extends EventEmitter {
    constructor() {
        super()
        this.logs = []
        this.maxLogs = 1000 // 最多保存1000条日志

        // 重写 console 方法来捕获日志
        const originalConsole = {
            log: console.log,
            error: console.error,
            warn: console.warn,
            info: console.info
        }

        // 包装控制台方法
        console.log = (...args) => {
            this.captureLog('log', originalConsole.log, ...args)
        }

        console.error = (...args) => {
            this.captureLog('error', originalConsole.error, ...args)
        }

        console.warn = (...args) => {
            this.captureLog('warn', originalConsole.warn, ...args)
        }

        console.info = (...args) => {
            this.captureLog('info', originalConsole.info, ...args)
        }
    }

    captureLog(level, originalMethod, ...args) {
        // 先调用原始方法，保持控制台输出的格式
        originalMethod.apply(console, args)

        // 获取格式化后的消息
        const util = require('util')
        const message = util.format(...args)

        const log = {
            timestamp: new Date(),
            level,
            message
        }

        this.logs.push(log)
        if (this.logs.length > this.maxLogs) {
            this.logs.shift()
        }

        this.emit('newLog', log)
    }

    getLogs(limit = 100) {
        return this.logs.slice(-limit)
    }

    clearLogs() {
        this.logs = []
        this.emit('logsCleared')
    }
}

module.exports = LogManager 