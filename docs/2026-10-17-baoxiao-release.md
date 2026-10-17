# 报销测试仪发布

- 入口：https://baox.ai/baoxiao，站点目录 baoxiao/，与 activity/、zhibo/ 一样通过静态构建发布。
- 保藏第三张卡片：报销测试仪，沿用一键直达及现有三列布局；应用总数为 03。
- 上传的计算逻辑保持原样；名称统一为报销测试仪，使用站点 favicon。
- 会员功能暂缓，代码保留在 feature/membership；本次 main 恢复静态站点配置。
- 同步：桌面 WEB/baoxiao、WEB/collection 以及 Documents/WEB/baox-collection-release。

## 无字封面

内置 image_gen 生成，参考用户提供的 MG-VOXSTAGE 标准图。提示方向：米色旧纸底，黑白网点医院、撕纸医疗票据和计算器，红色箭头指向手掌中的金币，淡化的区域地图与定位点；无标题、标语、品牌或水印，优先小尺寸可识别性。

最终资产：collection/assets/reimbursement-vox.webp，960×540，92768 bytes；cwebp 质量80、method6、目标94000 bytes。原始生成图保留在本机 generated_images，不随网站发布。

已有封面：activity-tracker.webp 48386 bytes、live-assistant.webp 52276 bytes。三张均小于100000 bytes，图片懒加载并异步解码。

## 验证

静态构建成功，四个应用/频道路由本地返回200，依赖文件全部存在，内联JS语法通过。浏览器验证默认计算和无社保状态切换会实时更新结果，并确认保藏三张卡片完整显示。
