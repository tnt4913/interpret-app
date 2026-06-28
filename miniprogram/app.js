// app.js
App({
  globalData: {
    // 后端服务地址，部署后替换为你的服务器地址
    serverUrl: 'ws://localhost:3000',
    httpUrl: 'http://localhost:3000',
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
