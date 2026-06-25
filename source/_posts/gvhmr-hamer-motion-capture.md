---
title: 从单目视频到二次元角色动画：GVHMR 与 HaMeR 骨骼提取流程
date: 2026-06-25 21:17:45
tags:
  - GVHMR
  - HaMeR
  - 动捕
categories:
  - 技术文档
cover: /assets/images/covers/GSZyq7FcgcWJ7VvOAp0MNUXx.jpeg
---

<section class="result-showcase">
  <div class="result-showcase__text">
    <span>最终效果展示</span>
    <a href="https://www.bilibili.com/video/BV1Tu9xBDE5z/" target="_blank" rel="noopener">Bilibili：动作重定向成品预览</a>
  </div>
  <a href="https://www.bilibili.com/video/BV1Tu9xBDE5z/" target="_blank" rel="noopener">
    <img src="/assets/images/posts/gvhmr-hamer/final-demo.png" alt="最终效果展示">
  </a>
</section>

很久之前（大概是24年底）想做mmd，但是喜欢的歌曲，舞蹈并没有配布的动作，于是了解了无标记视频动捕相关的产品。

主流的视频动捕是有单摄多摄的区别，拍摄角度越多，越方便确认人在空间中的位置，就像主视图＋侧视图确定坐标，两条直线确定交叉点那样。只是真实动捕里多条视线通常不会精确相交，所以是最小化重投影误差/概率最大化/体素投票，而不是几何上完美求交。单目视频动捕的优势是门槛低，但问题也明显：深度方向不稳定、脚底滑步、手部细节差、角色重定向后容易穿模。单摄更依赖“学习到的人体运动先验”；多摄除了学习，还多了“几何约束”，因此空间定位更稳定。

由于还是学生，既没有动捕棚也没有多摄系统，自然希望把这个获取动作的成本降低一些，哪怕是后期需要我手动编辑调整一下。因此，最开始的目标并不是做一个纯学术算法，而是想探索“个人是否可以用普通视频生成可复用的角色动画资产”。

## 整体的流程

输入单目视频

↓

GVHMR：恢复全身姿态、SMPL/SMPL-X、全局轨迹

↓

HaMeR：逐帧恢复左右手 MANO 手部姿态

↓

动作清洗：脚底锁定、滤波、穿地修正

↓

身体与手部坐标对齐 / 骨骼缝合

↓

重定向到目标二次元角色骨骼

↓

Blender / Unity 中检查动画效果

## GVHMR  

解决的是单目视频里的全身人体运动恢复。相比只输出相机坐标系下的人体姿态，GVHMR 更关注 world-grounded motion，也就是人在世界空间中的运动轨迹、朝向和姿态。它的 Gravity-View Coordinates 思路可以理解为：用重力方向和相机视角方向构造更稳定的坐标表达，从而减少长序列预测时的全局漂移。同时增加了脚部是否落地的ik判定，减少了滑步和漂浮。

https://zju3dv.github.io/gvhmr/?utm_source=chatgpt.com

部署参考 https://sundaybox.cc/pages/f09129/

天晴这个文档详细讲述了如何在windows系统配置，也分享了win版本的配置流程，win和wsl的安装包等等，此处就不再详细阐述了

我一开始是在wsl上的Ubuntu20.04配置的，通过vscode远程链接的 按照gvhmr仓库给的requirements配置就好，这里再贴一下

https://github.com/zju3dv/GVHMR/blob/main/docs/INSTALL.md

好了，到此处就可以生成动作了~

官方给出的demo.py生成了视频和.pt文件， 实际上我们想把生成的动作重定向给二次元模型，所以我们需要把内存里的pred文件（.pt也是根据这个生成的）对人物动作有关的参数提取出来

<ul class="note-plain-list">
  <li>smpl_params_global</li>
  <li>smpl_params_incam</li>
</ul>

转换成.pkl文件

然后再整理一下关于各种输出方法的命令（基于demo.py和我输出的要求改写的，demo9.py）

默认静态相机：

```bash
python tools/demo/demo9.py --video /home/if/GVHMR/docs/example_video/keai.mp4 --camera_motion static
```

保留 DPVO：

```bash
python tools/demo/demo9.py --video /home/if/GVHMR/docs/example_video/ice.mp4 --camera_motion dpvo
```

指定第 n 个人：

```bash
python tools/demo/demo9.py --video /home/if/GVHMR/docs/example_video/ice.mp4 --person 1
```

输出全局视频和拼接视频：

```bash
python tools/demo/demo9.py --video /home/if/GVHMR/docs/example_video/keai.mp4 --render_global
```

强制重渲染视频：

```bash
python tools/demo/demo9.py --video /home/if/GVHMR/docs/example_video/ice.mp4 --render_global --overwrite_render
```

强制重跑预处理和模型结果：

```bash
python tools/demo/demo9.py --video /home/if/GVHMR/docs/example_video/ice.mp4 --overwrite_preprocess --overwrite_results
```

保留 demo.py 的 SimpleVO + f_mm：

```bash
python tools/demo/demo9.py --video /home/if/GVHMR
```

现在，基于 GVHMR 的结果，我们已经可以从单目视频中导出较完整的身体动作，包括躯干、头部、四肢以及全局位移信息。但在实际角色动画中，只有身体姿态还不够。很多动作的表现力来自手部，例如挥手、指向、比心、抓握、张开手掌等。如果只保留肢体动作，角色看起来会像“身体在动，但手是僵的”，动作细节和表演感都会明显下降。

因此，这里进一步引入 HaMeR 来补充手部动作。HaMeR，全称可以理解为 Hand Mesh Recovery，是一个面向单目图像的 3D 手部重建方法。它可以从普通 RGB 图像中识别手部区域，并预测对应的 MANO 手部模型参数，从而恢复出手掌、手指关节以及完整的三维手部 mesh

需要注意的是，HaMeR 本身输出的是手部重建结果，只有单帧的，并不会自动变成可直接驱动角色的完整动画。因此，在实际接入时还需要处理手腕位置对齐、尺度匹配、左右手区分、单帧抖动滤波，以及与目标角色骨骼的重定向关系。

那么先来讲如何配置HaMeR（此处感谢星屑老师的特别帮助）

项目地址  https://github.com/geopavlakos/hamer

由于HaMeR这个项目有一点点老，按照readme里面配置总会遇到一些报错或者冲突，我仔细参考了他给的配置相关的所有内容，最后选择了参考他给的dockerfile来配

用 WSL2 + Ubuntu 22.04

用 Python 3.10

在 WSL 的 Linux 文件系统里装，不要放在 /mnt/c/...

优先按仓库当前 Dockerfile 的版本组合来装：PyTorch 2.2.0 + torchvision 0.17.0 + cu118

先复现 官方 demo，确认跑通后再做训练或评测

原因是：仓库 README 里安装 PyTorch 的示例还是 cu117，但仓库当前 Dockerfile 已经更新到 Ubuntu 22.04 + torch 2.2.0 + cu118。

### 先决条件

Windows 11，或较新的 Windows 10

<p class="note-plain">WSL2</p>

NVIDIA 显卡

Ubuntu 22.04

Windows 端已经装好 NVIDIA 的 WSL 驱动

官方文档里提到：

Microsoft 说明 WSL CUDA 需要合适的 NVIDIA 驱动、WSL、以及足够新的内核。

NVIDIA 文档明确说：在 WSL 里不要再装 Linux 显卡驱动，Windows 端那个驱动就够了。

注意：
成功经验

用 WSL2 + Ubuntu 22.04 + Python 3.10，不要换成更新的 Python。

项目一定放在 WSL Linux 文件系统里，比如 ~/projects/hamer，不要放 /mnt/c/...。

不要直接照 README 无脑装最新版依赖。这个项目的老依赖会和 2026 年的新打包生态冲突。

最稳的组合是：

<p class="note-plain">pip==24.3.1</p>

setuptools==81.0.0

wheel==0.44.0

numpy==1.23.5

scikit-image==0.23.2

torch==2.2.0

torchvision==0.17.0

mmcv==1.3.9

chumpy 和新 numpy 不兼容，所以一定要把 numpy 锁死到 1.23.5。

mmcv==1.3.9 和 setuptools>=82 不兼容，所以一定要把 setuptools 固定到 81.0.0。

所有 pip install 前都建议先：

```bash
export PIP_CONSTRAINT="$PWD/constraints.txt"
```

否则某个包可能偷偷把 numpy 又升级回 2.x。

fetch_demo_data.sh 的 Google Drive 很容易限流，优先用 UT Austin 官方镜像。

MANO 下载时，只要 mano_v1_2.zip 里的 models/MANO_RIGHT.pkl。

demo.py 有一个小坑：它可能会误以为你没下载过 demo 数据，然后重新下 5.7GB。要把 hamer_demo_data.tar.gz 放进 _DATA/。

regnety 的 detectron2 权重下载也可能中断，建议手动下载到 _DATA/detectron2/model_final_ef3a80.pkl。

## 完整教程

装指定版本Ubuntu:
Windows PowerShell：

```bash
wsl --list –online
wsl --install -d Ubuntu-22.04
wsl –update
wsl --set-default-version 2
```

重启，打开ubuntu，检查：nvidia-smi

![gvhmr＋hamer](/assets/images/posts/gvhmr-hamer/image1.png)

再检查一下系统版本：

```bash
uname -a
python3 --version
```

应该为python 3.10

还有一个很重要的点：项目放到 Linux 文件系统里，比如：

```bash
mkdir -p ~/projects
cd ~/projects
```

不要放在 /mnt/c/Users/...。

### 第 1 步：安装系统依赖

在 Ubuntu 里执行：

```bash
sudo apt update
sudo apt install -y \
  git wget ffmpeg gcc g++ make \
  python3.10 python3.10-venv python3.10-dev python3-pip \
  libsm6 libxext6 libglfw3-dev libgles2-mesa-dev
```

### 第 2 步：克隆仓库，必须带子模块

这个仓库有一个关键子模块 third-party/ViTPose，所以一定要带 –recursive：

```bash
mkdir -p ~/projects
cd ~/projects
git clone --recursive https://github.com/geopavlakos/hamer.git
cd hamer
```

### 第 3 步：创建虚拟环境

在仓库根目录执行：

<ul class="note-plain-list">
  <li>python3.10 -m venv .hamer_clean</li>
  <li>source .hamer_clean/bin/activate</li>
</ul>

确认一下现在用的是虚拟环境里的 Python：

```bash
which python
python –version
```

### 第 4 步：创建约束文件，锁定最关键版本

```bash
cat > constraints.txt <<'EOF'
numpy==1.23.5
scikit-image==0.23.2
setuptools==81.0.0
wheel==0.44.0
pip==24.3.1
EOF
```

然后启用它：

```bash
export PIP_CONSTRAINT="$PWD/constraints.txt"
```

### 第 5 步：装最关键的构建工具和 PyTorch

```bash
python -m pip install --force-reinstall "pip==24.3.1" "setuptools==81.0.0" "wheel==0.44.0"
python -m pip install torch==2.2.0 torchvision==0.17.0 --index-url https://download.pytorch.org/whl/cu118
python -m pip install gdown "numpy==1.23.5"
```

### 第 6 步：装最容易炸的老依赖

```bash
python -m pip install --no-build-isolation "chumpy==0.70"
python -m pip install --no-build-isolation "mmcv==1.3.9"
```

### 第 7 步：安装 ViTPose 和剩余依赖

```bash
python -m pip install --no-build-isolation -e third-party/ViTPose
python -m pip install opencv-python pyrender pytorch-lightning "scikit-image==0.23.2" smplx==0.1.28 yacs timm einops xtcocotools pandas hydra-core hydra-submitit-launcher hydra-colorlog pyrootutils rich webdataset
python -m pip install "detectron2 @ git+https://github.com/facebookresearch/detectron2"
python -m pip install -e . --no-deps
```

### 第 8 步：安装完成后先验证环境

```bash
python - <<'PY'
import setuptools, numpy, torch
import chumpy, mmcv, detectron2, hamer
print("setuptools =", setuptools.__version__)
print("numpy =", numpy.__version__)
print("torch =", torch.__version__)
print("cuda available =", torch.cuda.is_available())
print("chumpy ok")
print("mmcv =", mmcv.__version__)
print("detectron2 ok")
print("hamer ok")
```

PY

```bash
export PIP_CONSTRAINT="$PWD/constraints.txt"
python -m pip install "opencv-python==4.8.0.76"
```

再检查依赖一致性：

```bash
python -m pip check
```

### 第 9 步：下载 HaMeR demo 数据，不用 Google Drive

```bash
wget -O hamer_demo_data.tar.gz https://www.cs.utexas.edu/~pavlakos/hamer/data/hamer_demo_data.tar.gz
tar --warning=no-unknown-keyword --exclude=".*" -xvf hamer_demo_data.tar.gz
mkdir -p _DATA
mv hamer_demo_data.tar.gz _DATA/
```

### 第 10 步：下载 MANO

https://mano.is.tue.mpg.de/login.php  注册账号登录

![gvhmr＋hamer](/assets/images/posts/gvhmr-hamer/image2.png)

![gvhmr＋hamer](/assets/images/posts/gvhmr-hamer/image3.png)

点击下载 mano_v1_2.zip，然后取出：

mano_v1_2/models/MANO_RIGHT.pkl

放到这里：

```bash
mkdir -p _DATA/data/mano
cp /你的路径/mano_v1_2/models/MANO_RIGHT.pkl _DATA/data/mano/
```

或者手动拖进wsl

手动下载 regnety 检测器权重，避免运行时下载中断

```bash
mkdir -p _DATA/detectron2
wget -c -O _DATA/detectron2/model_final_ef3a80.pkl \
```

https://dl.fbaipublicfiles.com/detectron2/new_baselines/mask_rcnn_regnety_4gf_dds_FPN_400ep_LSJ/42045954/model_final_ef3a80.pkl

再检查关键文件是否都在

```bash
python - <<'PY'
import os
for p in [
    "_DATA/hamer_ckpts/checkpoints/hamer.ckpt",
    "_DATA/vitpose_ckpts/vitpose+_huge/wholebody.pth",
    "_DATA/data/mano/MANO_RIGHT.pkl",
    "_DATA/detectron2/model_final_ef3a80.pkl",
    "example_data",
]:
    print(os.path.exists(p), p)
```

PY

跑demo

```bash
python demo.py \
  --img_folder example_data \
  --out_folder demo_out \
  --batch_size 1 \
  --body_detector regnety \
  --side_view \
  --save_mesh \
  --full_frame
```

第一次一定从 --batch_size 1 开始。

查看结果

```bash
find demo_out -maxdepth 2 -type f | sort
```

注释：
pip install -e third-party/ViTPose 报 No module named 'pip'

原因：chumpy 太老，和新 pip 的隔离构建冲突。

规避：用 pip==24.3.1，并且 chumpy 用 --no-build-isolation 安装。

ImportError: cannot import name 'int' from numpy

原因：chumpy 不兼容 numpy 1.24+ / 2.x

规避：固定 numpy==1.23.5

mmcv 1.3.9 报 No module named 'pkg_resources'

原因：setuptools>=82 移除了 pkg_resources

规避：固定 setuptools==81.0.0

后面某次安装又把 numpy 升回 2.x

原因：你没持续使用约束文件

规避：一直保留

```bash
export PIP_CONSTRAINT="$PWD/constraints.txt"
```

fetch_demo_data.sh 报 Google Drive “Too many users”

原因：Drive 限流

规避：直接用 cs.utexas.edu 镜像下载

demo.py 又重新下 5.7GB

原因：它只检查 _DATA/hamer_demo_data.tar.gz 是否存在

规避：把下载好的 hamer_demo_data.tar.gz 放进 _DATA/

运行 demo 时 detectron2 权重下载一半失败

原因：网络中断，urllib 不支持断点续传

规避：手动 wget -c 下载到 _DATA/detectron2/model_final_ef3a80.pkl

一些警告很多，看起来吓人

下面这些通常不阻塞 demo：

<ul class="note-plain-list">
  <li>apex is not installed</li>
  <li>timm ... FutureWarning</li>
  <li>pkg_resources is deprecated</li>
  <li>mmcv-full 相关警告</li>
</ul>

### 运行方式

```bash
cd ~/projects/hamer
source .hamer_clean/bin/activate
export PIP_CONSTRAINT="$PWD/constraints.txt"
python demo1.py \
  --video_path /example_dataice.mp4
  --out_folder demo2_out \
  --batch_size 1 \
  --body_detector regnety
```

如果还要导出 mesh：

```bash
python demo2.py \
  --video_path /path/to/your_video.mp4 \
  --out_folder demo2_out \
  --batch_size 1 \
  --body_detector regnety \
  --save_mesh
```

以后每次开新终端，先做这三步：

```bash
cd ~/projects/hamer
source .hamer_clean/bin/activate
export PIP_CONSTRAINT="$PWD/constraints.txt"
```

现在我们知道如何生成单帧的手部模型了，接下来我写了个脚本让他直接生成.pkl方便导入软件使用

比较完

```bash
python demo7.py \
 --video_path example_data/keai.mp4 \
 --batch_size 4 \
 --detect_interval 2 \
 --window 11 \
 --out_folder demo_hamer_out \
 --smplx_model_path smplx/SMPLX_FEMALE.npz
```

基础命令：

```bash
python demo7.py --video_path example_data/ice.mp4
```

指定输出目录：

```bash
python demo7.py --video_path example_data/ice.mp4 --out_folder demo_hamer_out
```

只导出 pkl，不生成 overlay 视频：

```bash
python demo7.py --video_path example_data/ice.mp4 --skip_render
```

调整 batch size：

```bash
python demo7.py --video_path example_data/ice.mp4 --batch_size 8
```

调整检测间隔，默认每 2 帧检测一次：

```bash
python demo7.py --video_path example_data/ice.mp4 --detect_interval 1
```

调整平滑窗口，默认 11，必须是奇数：

```bash
python demo7.py --video_path example_data/ice.mp4 --window 15
```

指定 HaMeR checkpoint：

```bash
python demo7.py --video_path example_data/ice.mp4 --checkpoint path/to/checkpoint.ckpt
```

指定 SMPL-X 模型，用于导出绝对手部姿态相关字段：

```bash
python demo7.py --video_path example_data/ice.mp4 --smplx_model_path smplx/SMPLX_NEUTRAL.npz
--window 11
```

## 身体和手部到底是怎么“缝合”起来的？

前面已经分别得到了两部分结果：

GVHMR 负责身体动作。它输出的是 SMPL/SMPL-X 风格的人体参数，包括身体姿态、根节点位移、全局朝向等。这里最关键的字段是：

global_orient
transl
body_pose
betas

其中 body_pose 里面已经包含了身体 21 个关节的局部旋转，手腕关节也在里面，只是这个手腕更多是“身体骨架的一部分”，并不包含完整的手指动作。

HaMeR 负责手部动作。它输出的是左右手的 MANO 手部结果，主要包括：

global_orient
hand_pose

其中 global_orient 表示整只手在相机坐标系下的朝向，hand_pose 表示 15 个手指关节的旋转。

所以最直观的想法是：

GVHMR 给身体，HaMeR 给手指，把 HaMeR 的手部参数直接塞进 SMPL-X 的 left_hand_pose 和 right_hand_pose 里，不就完成了吗？

实际测试之后发现，不能这么简单。原因是手部动画不是一个孤立模块，它和手腕、小臂、肩膀、根节点坐标系都有关系。只贴手指动作，手掌方向可能对不上；只贴手掌方向，小臂又可能不跟着转；如果坐标系没统一，甚至会出现手部整体扭转 90°、左右手镜像错误、手腕突然翻转等问题。

因此我的缝合流程分成了三层：

<ul class="note-plain-list">
  <li>第一层：统一参考坐标系</li>
  <li>第二层：把 HaMeR 的手部全局朝向转成 SMPL-X 的局部手腕旋转</li>
  <li>第三层：把手指旋转写入 SMPL-X 的 left_hand_pose / right_hand_pose</li>
</ul>

### 为什么要先选参考坐标系？

这里是整个缝合里最容易混乱的地方。

HaMeR 的 global_orient 是在原视频图像对应的相机坐标系下预测出来的，也就是 camera-space / incam 的手部朝向。

而 GVHMR 这边可能同时有两套结果：

<ul class="note-plain-list">
  <li>smpl_params_incam</li>
  <li>smpl_params_global</li>
</ul>

incam 适合拿来和原视频叠加比较，因为它和相机视角一致；
global 适合后续导入 Blender、Unity 或 DCC 软件，因为它保留了角色在世界空间里的运动轨迹。

这就导致一个问题：

如果我直接用 HaMeR 的相机系手部朝向，去覆盖 GVHMR 的 global 身体姿态，就相当于把两个不同坐标系下的旋转硬拼在一起。表面看起来手指会动，但手腕方向很容易错。

所以脚本里默认采用这个规则：

<ul class="note-plain-list">
  <li>HaMeR 手部朝向：用 incam 分支解释</li>
  <li>导出动画：可以选择 global 或 incam</li>
</ul>

也就是说，我先在 incam 坐标系下把手和身体对齐，因为 HaMeR 本身就是相机系输出；等手腕的局部旋转算出来之后，再把这个局部旋转复制到 global 分支里。

这样做的原因是：

SMPL-X 的 body_pose 和 hand_pose 本质上是局部关节旋转。
一旦局部旋转计算正确，它就可以被放到不同的根节点坐标分支里复用。

脚本里对应的是这一步：

```bash
reference_branch_name = choose_reference_branch(
    gvhmr_branches, 
    args.wrist_reference_branch
)
```

默认逻辑是：

<ul class="note-plain-list">
  <li>优先使用 incam</li>
  <li>如果只有 flat 分支，则警告</li>
  <li>如果只能用 global，则提示可能会有相机系和世界系混用问题</li>
</ul>

所以这里不是“随便选一个分支”，而是在决定：

HaMeR 这只手的朝向，应该相对于哪一套身体骨架来解释。

未对齐坐标系效果如图

![gvhmr＋hamer](/assets/images/posts/gvhmr-hamer/image4.png)

### 手腕旋转为什么不能直接复制？

SMPL-X 的身体骨架里，手腕不是独立的全局物体。它是小臂下面的子关节。

也就是说，SMPL-X 里手腕真正需要的是：

手腕相对于小臂的局部旋转

但 HaMeR 输出的是：

整只手在相机坐标系里的全局旋转

两者不是同一个东西。

所以我们需要做一个转换：

HaMeR 手部全局旋转
→ 减去 GVHMR 小臂/肘部的全局旋转
→ 得到 SMPL-X 手腕局部旋转

用矩阵表达就是：

```bash
wrist_local = inverse(forearm_global) @ hamer_hand_global
```

这里的 forearm_global 是沿着 SMPL-X 骨骼层级，从根节点一路累乘到小臂关节得到的全局旋转。

脚本里对应的是：

```bash
left_elbow_global = compute_global_rotation(full_pose, 18)
right_elbow_global = compute_global_rotation(full_pose, 19)
```

然后：

```bash
left_local = np.linalg.inv(left_elbow_global) @ left_global
right_local = np.linalg.inv(right_elbow_global) @ right_global
```

这样得到的 left_local / right_local 才是可以写回 SMPL-X 手腕位置的旋转。

最后再把它写进 body_pose 中手腕对应的切片：

<ul class="note-plain-list">
  <li>LEFT_WRIST_BODY_SLICE = slice(57, 60)</li>
  <li>RIGHT_WRIST_BODY_SLICE = slice(60, 63)</li>
</ul>

也就是：

```bash
merged["body_pose"][frame_idx, LEFT_WRIST_BODY_SLICE] = wrist_body_pose[frame_idx, LEFT_HAND_INDEX]
merged["body_pose"][frame_idx, RIGHT_WRIST_BODY_SLICE] = wrist_body_pose[frame_idx, RIGHT_HAND_INDEX]
```

这一步完成后，SMPL-X 的手腕方向才真正跟 HaMeR 的手部朝向对上。

### 为什么缝合后手腕还是会“拧麻花”？

到这一步，我原本以为已经完成了。但实际导入 Blender 之后会发现一个很明显的问题：

手掌方向是对的，手指动作也是对的，但是手腕和小臂之间会出现不自然的扭转，像是蒙皮拧麻花了一样。

比如现实里我们把手伸出去，然后让掌心朝下，动作通常不是只有手腕一个关节在转，而是小臂也会参与旋转。也就是前臂的旋前 / 旋后。

但是 SMPL-X 的身体骨架里，并没有给小臂单独提供一个很细的 twist 骨骼。它更像是：

上臂
↓
小臂
↓
手腕
↓
手指

而很多动画软件或者二次元角色骨骼里，可能会有更细的结构：

forearm
forearm_twist
wrist
hand

这就导致一个问题：

HaMeR 看到的是整只手的最终朝向，它并不知道这个翻掌动作应该由“小臂转一部分，手腕转一部分”共同完成。

于是当我们把 HaMeR 的手部朝向全部塞给 SMPL-X 的 wrist 时，手腕就承担了过多旋转，结果看起来像手腕被拧了一圈。

所以这里不是手指识别错了，而是：

旋转角度的分配方式不符合真实人体和目标骨架结构。

拧麻花效果

![gvhmr＋hamer](/assets/images/posts/gvhmr-hamer/image5.jpeg)

### 关节旋转角度应该怎么分配？

理想情况下，一个翻掌动作应该被分配到多个关节上：

<ul class="note-plain-list">
  <li>肩膀：决定手臂大方向</li>
  <li>肘部/小臂：承担一部分前臂旋转</li>
  <li>手腕：承担最后的掌心朝向微调</li>
  <li>手指：负责具体手势</li>
</ul>

但现在 GVHMR 已经给出了身体动作，HaMeR 又给出了手部朝向。我们不能随便大幅修改肩膀和肘部，否则身体动作会变形。

所以我的处理策略是：

不破坏 GVHMR 的整体身体动作
优先保留 HaMeR 的手掌方向和手指动作
只对 wrist 里过度的轴向扭转做软限制

这里用到的是 swing-twist decomposition，也就是把一个旋转拆成两部分：

<ul class="note-plain-list">
  <li>swing：让手掌朝向目标方向的摆动</li>
  <li>twist：绕小臂轴线自身拧转的部分</li>
</ul>

可以理解成：

swing 负责“手指向哪里”
twist 负责“手掌绕着小臂拧了多少”

在动画里，最容易出问题的是 twist。因为 twist 过大时，手掌方向可能仍然对，但小臂和手腕会像麻花一样。

所以我没有直接把 wrist rotation 整体 clamp 掉，而是只处理 twist 部分：

```bash
swing, angle = decompose_swing_twist(wrist_mats[frame_idx, hand_idx], axis)
```

然后对超过阈值的 twist 做软限制：

```bash
if abs_angle <= limit_rad:
    return angle

damped = limit_rad + (abs_angle - limit_rad) * excess_keep
```

也就是说，假设阈值是 150°，超过 150° 的部分不会被完全砍掉，而是只保留一小部分。这样不会突然破坏手掌方向，也不会出现硬截断导致的跳变。

脚本里默认参数是：

<ul class="note-plain-list">
  <li>--wrist_twist_mode soft_clamp</li>
  <li>--wrist_twist_limit_deg 150</li>
  <li>--wrist_twist_excess_keep 0.25</li>
</ul>

它的含义是：

<ul class="note-plain-list">
  <li>150°以内的手腕 twist 保留</li>
  <li>超过 150° 的部分只保留 25%</li>
</ul>

这样做的目的不是追求解剖学上完全正确，而是在当前 SMPL-X 骨架限制下，让动画结果更稳定、更像正常角色动画。

### 为什么还要做 unwrap？

旋转还有一个很烦人的问题：角度表达会在 180° 和 -180° 之间跳变。

例如连续两帧真实旋转可能是：

<ul class="note-plain-list">
  <li>178°</li>
  <li>181°</li>
  <li>184°</li>
</ul>

但计算机里可能会表示成：

<ul class="note-plain-list">
  <li>178°</li>
  <li>-179°</li>
  <li>-176°</li>
</ul>

从数值上看，中间突然跳了 357°，导入动画后就会变成手腕突然抽搐一下。

所以在处理 twist 序列时，我加了：

```bash
angles = np.unwrap(angles)
```

它的作用是把角度序列重新展开，让连续帧之间不要因为 ±π 的边界产生跳变。

这一步对于静态单帧展示可能不明显，但对动画非常关键。因为 Mano2SMPL-X 那种展示通常只是单帧图片，一张图看起来没问题，不代表连续播放时不会抖、不跳、不拧。

### 根节点运动又是怎么处理的？

手部缝合完成后，还有一个和导出动画有关的问题：root motion。

GVHMR 的 global 分支通常包含人物在世界空间里的移动，比如向前走、左右移动、上下起伏。这个对于真实运动重建是有意义的。

但是如果我要把动作导入 Blender / Unity，尤其是做舞蹈、角色展示或者 MMD 风格动画，有时并不希望角色在场景里漂走，而是希望它在原地跳舞。

所以脚本里加了三个模式：

<ul class="note-plain-list">
  <li>--root_motion_mode original</li>
  <li>--root_motion_mode inplace_xz</li>
  <li>--root_motion_mode inplace_xyz</li>
</ul>

含义分别是：

<ul class="note-plain-list">
  <li>original：保留原始根节点运动</li>
  <li>inplace_xz：去掉水平 X/Z 漂移，只保留上下运动</li>
  <li>inplace_xyz：根节点完全固定</li>
</ul>

我比较常用的是：

<p class="note-plain">--root_motion_mode inplace_xz</p>

因为它可以去掉角色在地面上的水平漂移，但保留跳跃、下蹲、身体起伏这些竖直方向动作。对于舞蹈动作展示会更自然。

不过这个功能只适合某些展示场景。如果是还原原视频中的走路、跑步、空间移动，就应该保留 original。

<p class="note-plain">--skip_render</p>

我测试用的Humanoid模型，这里再贴一下mmd模型的根骨骼处理方法

https://www.bilibili.com/video/BV13Vf9BnExZ/

以及基于之前做的手部方法 网友开发出来的整合插件

https://www.bilibili.com/video/BV1pD7a6gEum/

因此后续不再放出虚拟机了，感兴趣的也可以按照前面的步骤从官方项目配置

以上，即为4月没有考试 没有现实压力的纷扰，研究探索的项目，虽然很多工作都是站在前人的肩膀上，但是很幸运，可以全身心投入自己喜欢的事情并把它实现了

后续还会进行一些优化方面的研究，未完待续，

