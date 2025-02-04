const fs = require('fs').promises
const path = require('path')

class GroupManager {
    constructor(client) {
        this.client = client
        this.groups = new Map()
        this.configPath = path.join(__dirname, '../../data/groups.json')
    }

    async init() {
        try {
            // 确保data目录存在
            await fs.mkdir(path.dirname(this.configPath), { recursive: true })
            
            // 读取已保存的群配置
            try {
                const data = await fs.readFile(this.configPath, 'utf8')
                const savedGroups = JSON.parse(data)
                this.groups = new Map(Object.entries(savedGroups))
            } catch (error) {
                if (error.code !== 'ENOENT') {
                    console.error('读取群配置失败:', error)
                }
                // 如果文件不存在，使用空Map
                this.groups = new Map()
            }

            // 更新群列表
            await this.updateGroupList()
        } catch (error) {
            console.error('初始化群管理器失败:', error)
        }
    }

    async updateGroupList() {
        try {
            const groups = Array.from(this.client.gl.values())
            console.log('获取到群列表:', groups.length, '个群')
            
            // 遍历群列表并更新信息
            for (const group of groups) {
                const groupId = String(group.group_id)
                const existingGroup = this.groups.get(groupId)
                const groupInfo = {
                    name: group.group_name,
                    enabled: existingGroup ? existingGroup.enabled : false,  // 保持现有状态或默认禁用
                    member_count: group.member_count,
                    owner_id: group.owner_id,
                    admin_flag: group.is_admin
                }

                // 更新或添加群信息
                this.groups.set(groupId, groupInfo)
                console.log('添加/更新群:', groupId, groupInfo)
            }

            // 保存配置
            await this.saveConfig()
            
            const updatedList = this.getGroupList()
            console.log('更新后的群列表:', updatedList)
            return updatedList
        } catch (error) {
            console.error('更新群列表失败:', error)
            throw error
        }
    }

    async saveConfig() {
        try {
            const data = Object.fromEntries(this.groups)
            await fs.writeFile(this.configPath, JSON.stringify(data, null, 2))
        } catch (error) {
            console.error('保存群配置失败:', error)
        }
    }

    isGroupEnabled(groupId) {
        const group = this.groups.get(groupId.toString())
        const enabled = group ? group.enabled : false
        console.log(`检查群 ${groupId} 状态:`, enabled)
        return enabled
    }

    async enableGroup(groupId) {
        const group = this.groups.get(groupId.toString())
        if (group) {
            group.enabled = true
            await this.saveConfig()
            console.log(`群 ${groupId} 已启用`)
            return true
        }
        return false
    }

    async disableGroup(groupId) {
        const group = this.groups.get(groupId.toString())
        if (group) {
            group.enabled = false
            await this.saveConfig()
            console.log(`群 ${groupId} 已禁用`)
            return true
        }
        return false
    }

    getGroupList() {
        try {
            // 从 client.gl 获取最新的群列表
            const currentGroups = Array.from(this.client.gl.values())
            return currentGroups.map(group => ({
                group_id: String(group.group_id),
                group_name: group.group_name,
                member_count: group.member_count,
                enabled: this.isGroupEnabled(group.group_id),
                owner_id: group.owner_id,
                admin_flag: group.is_admin
            }))
        } catch (error) {
            console.error('获取群列表失败:', error)
            return []
        }
    }

    // 添加调试方法
    logGroupData() {
        console.log('当前群组数据:')
        console.log('Map大小:', this.groups.size)
        for (const [id, info] of this.groups.entries()) {
            console.log('群ID:', id)
            console.log('群信息:', info)
        }
    }
}

module.exports = GroupManager 