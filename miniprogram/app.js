// app.js
App({
  globalData: {
    // 本地调试用（电脑IP），部署后改为云端地址
    // 查找电脑IP：Windows输入 ipconfig，Mac输入 ifconfig
    // 例如：httpUrl: 'http://192.168.1.100:3000'
    httpUrl: 'http://localhost:3000',  // 开发者工具里用这个
    // 真机调试时，把上面改成你的电脑局域网IP，例如：
    // httpUrl: 'http://192.168.1.100:3000',
    // API 密钥配置（实际部署时放在后端，这里仅作前端标识）
    sessionKey: '',
    userInfo: null
  },

  onLaunch() {
    // 小程序启动时执行
    console.log('面试同传助手启动');

    // 检查更新
    const updateManager = wx.getUpdateManager();
    if (updateManager) {
      updateManager.onCheckForUpdate((res) => {
        console.log('是否有新版本:', res.hasUpdate);
      });
    }
  }
});
