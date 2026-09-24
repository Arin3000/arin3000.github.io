# HSKI 0070 ActorAnimation 头发解算器

当前为 **native 游戏实测注册顺序接入版**。19 项碰撞体中 17 项已确认对应；两条小腿保留旧相对顺序。原始资产参数改动 0；尚未取得原游戏同输入的全部骨骼逐帧轨迹，不能标为完整游戏运行时等价。

最新改动与手部重放见 [native_REGISTRATION_REPLAY_20260915.md](native_REGISTRATION_REPLAY_20260915.md)。第 24 帧层末手部代理重叠从 27.324 mm 降至 22.564 mm，采样窗口平均值略升，未完全解决。

- 修复胶囊字段、Quartz 单位/坐标转换、BendRoll 分量、积分、预热和分层碰撞。
- 修复先求旋转后约束骨长的顺序，以及 float32 逐步舍入和倒数乘法顺序。
- 3548 组独立原指令对照通过；其中 128 组整段积分最大位置差 2.80 微米、速度差 0，680 组 FromTo 输出差 0。
- 构建调用严格校验入口，失败即阻止构建；原有阈值未放宽。

详细证据与验证边界见 [NATIVE_RECONSTRUCTION_20260915.md](NATIVE_RECONSTRUCTION_20260915.md)。

## 文件

- `ActorAnimationSwingSolver.cs`：运行时实现；`HskiHairDynamics.cs` 为兼容子类。
- `HskiHair0070.json`：原始设置；Quartz 按原版转换一次。
- `native_oracle.py`：Unicorn 离线执行捕获镜像原指令，生成独立期望值。
- `ActorSwingNativeChecks.cs`：Unity 严格对照入口 `Run`。
- `HskiHairBuilder.cs`：校验后生成 native 播放器。
- `apply_registration_order.py`：匹配固定游戏采集、保留未确认项并生成排列。
- `native_evidence/`：反汇编、样本、资产审计、数值报告。

播放器：`output/HSKI_EffectsPreview/Player_native_registration_order/HSKI_Showcase.exe`。
录像：`output/HSKI_Hair_native_hand_audit_wind0/`。

旧 README 和修改前源码在 `before_prior/`；numeric_initial 运行结论保留在详细记录的历史章节。

手部专项结论与顺序验证缺口见 [HAND_COLLISION_AUDIT_20260915.md](HAND_COLLISION_AUDIT_20260915.md)。
