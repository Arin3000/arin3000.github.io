---
title: 借重装系统之机写一下我在windows里面使用linux的方法
date: 2025-02-20 11:54:00
tags:
  - WSL
  - Ubuntu
  - VS Code
  - CUDA
categories:
  - 技术文档
---

这篇文章由原 Word 笔记整理而来，记录在 Windows 中使用 Linux/WSL、配置开发环境、VS Code 远程开发以及 CUDA/PyTorch 环境处理的一些步骤。

## 重装前提醒
题外话，重装系统前请务必备份浏览器书签，在设置里面选导出html

请务必在sai2里面截图色板，截图自制的笔刷参数

（别的可能还有目前没遇到的回来遇到了再补充）

勾选上，然后以管理员身份运行powershell，输入


```bash
wsl –install
```

再打开MicrosoftStore，搜索并下载Ubuntu20 04（此处不要开梯子，但是可以使用小黑盒加速器开）

下载好之后直接在Microsoftstore里面点击打开

输入用户名和root的密码，此时你就可以使用sudo了

## 补充说明，这样虽说可以直接添加一个用户并正常使用，但是实际上root的密码是还没有设置的，只是相当于使用sudo给单个用户设置了密码

## 此处补：装指定版本Ubuntu:（演示版本为2204，并非前面所写的2004，实际上大差不差都行，这个方法简单，来自飞神的codex老师指导，但是不记得要不要翻墙了，如果要翻的话还是参照上面的）Windows PowerShell：


```bash
wsl --list –online
wsl --install -d Ubuntu-22.04
wsl –update
wsl --set-default-version 2
```

重启，打开ubuntu，检查：nvidia-smi

再检查一下系统版本：


```bash
uname -a
python3 --version
```

应该为python 3.10

下载好之后打开cmd输入


```bash
wsl
passwd root
```

输入密码（你看不到你输的密码，所以请务必记牢）

再输一遍


```bash
apt-get install sudo（为了方便给新用户分配一定的下载权限，而不是一直使用root）
adduser （你的用户名）
```

su (你的用户名)

这样就切换到你的用户了（如果再换回root就使用su，换回用户就su+用户名）

## 下载visualstudiocode（https://code.visualstudio.com）然后下载wsl的扩展，ctrl+shift+P选择connecttowsl，默认进入home/(用户名)的目录，然后把下面的那块拉起来，选择Terminal，这样就可以愉快地在vsc里面使用命令行复制粘贴啦~

## 如果这时尝试下载东西，会发现直连的源特别特别的慢（挂梯能用但是慢），所以我们需要换成国内源（网上常见的手动安装方法待复制粘贴补充，这里说一种不太常见但是很方便的）

（如果后续需要给wsl翻墙，请直接忽视这一条，换源后ipv6下载偶尔不稳，翻的话不用考虑这个）

先安装http相关的包


```bash
sudo apt install apt-transport-https
sudo apt install ca-certificates
```

以上两行用默认的源


```bash
sudo sed -i 's/archive.ubuntu.com/mirrors.ustc.edu.cn/g' /etc/apt/sources.list
```

以上这一行写完没有任何反应是正常的，就说明改好了

此时输入 sudo apt update

应该是可以看到下载的源变成了中科大的镜像源（此次只是拿这个举例，具体原理上来说可以挑选离自己地理位置近的源，个人感觉国内的都大差不差，看喜好）


```bash
sudo apt install build-essential
sudo apt install gdb（这两行是build相关工具下载）
sudo apt install neofetch
sudo apt update
sudo apt upgrade
neofetch（可以看一下自己的配置然后装逼）
apt install nvidia-cuda-toolkit
//nvcc -V(这个不要写，后面会将为什么不要这一步，输入这一步之后报错是正常现象不要修不用管)
nvidia-smi（这三行是显卡相关的）
```

## 以下这段是windows里面方便下载网页小工具的配置环境，也可以拿来干别的，但是个人更习惯一个地方解决所以后面在wsl里面装anaconda了（或者miniconda也可以）

## 下载并安装anaconda，https://www.anaconda.com 去官网复制镜像站最新的下载命令，不要抄别的地方的旧的了，.sh结尾的，没有wget就用curl，要是给虚拟机的盘空间小的话就下miniconda，一样的步骤用起来大差不差，对于写代码来说，复现的话建议所有环境都跟说明的一模一样不要搞创新

下载的时候卡在最后cache那一步应该是属于普遍现象，多等一等（windows里面的同理）


```bash
source ~/.bashrc激活环境变量 用户名前面出现(base)
conda –version  验证一下是不是装上了
pip install art -i https://pypi.mirrors.ustc.edu.cn/simple/（这是pip换源指令，功能相似就放一起写）
```

## 配置conda镜像源


```bash
conda config --set show_channel_urls yes
conda config --add channels https://mirrors.tuna.tsinghua.edu.cn/anaconda/pkgs/main/
conda config --add channels https://mirrors.tuna.tsinghua.edu.cn/anaconda/pkgs/free/
conda config --add channels https://mirrors.tuna.tsinghua.edu.cn/anaconda/cloud/conda-forge/
pip config set global.index-url https://pypi.tuna.tsinghua.edu.cn/simple
```

下载的时候尽量用pip，不要conda和pip混用，否则可能导致删不干净或者版本冲突（当然不介意的话也可以开新环境）

## 以下为网页下片小工具，在windows里面的anaconda使用可以直接下载的windows本地而不用重新映射目录或者拖文件


```bash
conda install -c conda-forge ffmpeg
yt-dlp --cookies-from-browser firefox  -f bestvideo+bestaudio --merge-output-format mp4 -P "E:/ArinLee/music" "https://www.bilibili.com/video/BV1rdHnerE1V"
```

## 配c语言环境，.vscode配置文件

## 以下是我的

支持python，c，c艹，cmake，java，latex


```bash
/home/if/.vscode/c_cpp_properties.json
```

```json
{
"configurations": [
{
"name": "Linux",
"includePath": [
"/usr/include/opencv4",
"/usr/include/opencv4/opencv2",
"${workspaceFolder}/**"
],
"defines": [],
"compilerPath": "/usr/bin/g++",
"cStandard": "c11",
"cppStandard": "c++17",
"intelliSenseMode": "linux-gcc-x64"
}
],
"version": 4
}
/home/if/.vscode/launch.json
{
// Use IntelliSense to learn about possible attributes.
// Hover to view descriptions of existing attributes.
// For more information, visit: https://go.microsoft.com/fwlink/?linkid=830387
"version": "0.2.0",
"configurations": [
{
"type": "java",
"name": "UserInfo",
"request": "launch",
"mainClass": "UserInfo"
},
{
"name": "(gdb) 启动",
"type": "cppdbg",
"request": "launch",
"program": "${workspaceFolder}/test/build",
"args": [],
"stopAtEntry": false,
"cwd": "${workspaceFolder}",
"environment": [],
"externalConsole": false,
"MIMode": "gdb",
"setupCommands": [
{
"description": "为 gdb 启用整齐打印",
"text": "-enable-pretty-printing",
"ignoreFailures": true
}
],
"preLaunchTask": "Build"
},
{
"name": "C/C++",
"type": "cppdbg",
"request": "launch",
"program": "${fileDirname}/${fileBasenameNoExtension}",
"args": [],
"stopAtEntry": false,
"cwd": "${workspaceFolder}",
"environment": [],
"externalConsole": false,
"MIMode": "gdb",
"preLaunchTask": "compile",
"setupCommands": [
{
"description": "Enable pretty-printing for gdb",
"text": "-enable-pretty-printing",
"ignoreFailures": true
}
]
}
]
}
/home/if/.vscode/settings.json
{
"cmake.sourceDirectory": "/home/if/test",
"latex-workshop.latex.autoBuild.run": "never",
"latex-workshop.showContextMenu": true,
"latex-workshop.intellisense.package.enabled": true,
"latex-workshop.message.error.show": false,
"latex-workshop.message.warning.show": false,
"latex-workshop.latex.tools": [
{
"name": "xelatex",
"command": "xelatex",
"args": [
"-synctex=1",
"-interaction=nonstopmode",
"-file-line-error",
"%DOCFILE%"
]
},
{
"name": "pdflatex",
"command": "pdflatex",
"args": [
"-synctex=1",
"-interaction=nonstopmode",
"-file-line-error",
"%DOCFILE%"
]
},
{
"name": "latexmk",
"command": "latexmk",
"args": [
"-synctex=1",
"-interaction=nonstopmode",
"-file-line-error",
"-pdf",
"-outdir=%OUTDIR%",
"%DOCFILE%"
]
},
{
"name": "bibtex",
"command": "bibtex",
"args": [
"%DOCFILE%"
]
}
],
"latex-workshop.latex.recipes": [
{
"name": "XeLaTeX",
"tools": [
"xelatex"
]
},
{
"name": "PDFLaTeX",
"tools": [
"pdflatex"
]
},
{
"name": "BibTeX",
"tools": [
"bibtex"
]
},
{
"name": "LaTeXmk",
"tools": [
"latexmk"
]
},
{
"name": "xelatex -> bibtex -> xelatex*2",
"tools": [
"xelatex",
"bibtex",
"xelatex",
"xelatex"
]
},
{
"name": "pdflatex -> bibtex -> pdflatex*2",
"tools": [
"pdflatex",
"bibtex",
"pdflatex",
"pdflatex"
]
}
],
"latex-workshop.latex.clean.fileTypes": [
"*.aux",
"*.bbl",
"*.blg",
"*.idx",
"*.ind",
"*.lof",
"*.lot",
"*.out",
"*.toc",
"*.acn",
"*.acr",
"*.alg",
"*.glg",
"*.glo",
"*.gls",
"*.ist",
"*.fls",
"*.log",
"*.fdb_latexmk"
],
"latex-workshop.latex.autoClean.run": "onFailed",
"latex-workshop.latex.recipe.default": "lastUsed",
"latex-workshop.view.pdf.internal.synctex.keybinding": "double-click",
"editor.accessibilitySupport": "off",
//"workbench.iconTheme": "vscode-icons",
"tabnine.experimentalAutoImports": true,
"code-runner.runInTerminal": true,
"security.workspace.trust.untrustedFiles": "open",
"C_Cpp.default.cppStandard": "c++23",
"C_Cpp.default.cStandard": "c23",
"cmake.configureOnOpen": true,
"security.allowedUNCHosts": [
"wsl.localhost"
],
"latex-workshop.intellisense.biblatexJSON.replace": {
},
"latex-workshop.view.pdf.viewer": "external",
"latex-workshop.view.pdf.external.viewer.command":
```

"C:/Users/Arin/AppData/Local/SumatraPDF/SumatraPDF.exe",  //注意修改路径


```bash
"latex-workshop.view.pdf.external.viewer.args": [
"%PDF%"
],
"latex-workshop.view.pdf.external.synctex.command":
```

"C:/Users/Arin/AppData/Local/SumatraPDF/SumatraPDF.exe",  //注意修改路径


```bash
"latex-workshop.view.pdf.external.synctex.args": [
"-forward-search",
"%TEX%",
"%LINE%",
"%PDF%",
],
"files.associations": {
"iostream": "cpp",
"cmath": "cpp",
"stdio.h": "c"
},
}
/home/if/.vscode/tasks.json
{
"version": "2.0.0",
"tasks": [
// 保留原有的 CMake 相关任务
{
"label": "cmake",
"type": "shell",
"command": "cmake",
"args": [
".."
],
"options": {
"cwd": "${workspaceFolder}/build"
},
"detail": "生成 Makefile"
},
{
"label": "make",
"type": "shell",
"command": "make",
"options": {
"cwd": "${workspaceFolder}/build"
},
"detail": "使用 Makefile 进行编译"
},
{
"label": "Build",
"dependsOrder": "sequence",
"dependsOn": [
"cmake",
"make"
],
"detail": "运行 CMake 和 Make"
},
// 添加新的、用于编译单个 C 文件的任务
{
"type": "cppbuild",
"label": "C/C++: gcc build active file",
"command": "/usr/bin/gcc",
"args": [
"-g",
"${file}",
"-o",
"${fileDirname}/${fileBasenameNoExtension}"
],
"options": {
"cwd": "${fileDirname}"
},
"problemMatcher": [
"$gcc"
],
"group": {
"kind": "build",
"isDefault": true
},
"detail": "编译器: /usr/bin/gcc"
}
]
}
```

## 接下来可以愉快地在vscode里面远程连接你的ubuntu主机写代码了~


```bash
//此处接上文nvcc -V，可以解决报错但是会为后续固定特定的cuda版本埋下隐患，看看得了，后面会再讲cuda    调整linux的cuda版本，涉及抄东西需要对应的环境，这个之前研究很久没整明白，csdn上面那个做库的软链接的方法不能有效地解决在这个问题，但是后来通过询问gpt解决了
```

## 要将 CUDA 12.8 降级到 CUDA 12.1，需要按照以下步骤操作。确保你已经卸载旧版本并正确安装目标版本，避免兼容性问题。以下指南适用于 Ubuntu/Linux 系统。

## ✅ 一、确认当前 CUDA 版本

查看已安装的 CUDA 版本：


```bash
nvcc --version
```

或


```bash
nvidia-smi
```

查看已安装的 CUDA 软件包：


```bash
dpkg -l | grep cuda
```

## ✅ 二、卸载 CUDA 12.8

使用 apt 卸载 CUDA：


```bash
sudo apt-get --purge remove "*cuda*" "*nvidia*" "*cublas*" "*cudnn*"
```

清理多余依赖和缓存：


```bash
sudo apt-get autoremove
sudo apt-get autoclean
```

删除残留文件：


```bash
sudo rm -rf /usr/local/cuda*
sudo rm -rf /etc/cuda*
```

## ✅ 三、下载并安装 CUDA 12.1

访问 NVIDIA 官方 CUDA 存档：

CUDA 12.1 下载地址

根据系统选择安装包（例如 Ubuntu 22.04）：

Local deb (本地 deb 包) 推荐使用这种方式。

添加 NVIDIA CUDA 仓库


```bash
https://developer.nvidia.com/cuda-12-1-0-download-archive?target_os=Linux&target_arch=x86_64&Distribution=WSL-Ubuntu&target_version=2.0&target_type=deb_local
```

pytorch目前只支持到12.1，不要一开始装12.8不然还得卸）


```bash
https://developer.nvidia.com/cuda-12-1-0-download-archive
```

## ✅ 四、配置环境变量

设置 CUDA 软链接：


```bash
sudo ln -s /usr/local/cuda-12.1 /usr/local/cuda
```

添加 CUDA 路径到环境变量：

echo 'export PATH=/usr/local/cuda/bin:$PATH' >> ~/.bashrc

echo 'export LD_LIBRARY_PATH=/usr/local/cuda/lib64:$LD_LIBRARY_PATH' >> ~/.bashrc


```bash
source ~/.bashrc
```

## ✅ 五、验证 CUDA 安装

检查 CUDA 版本：


```bash
nvcc --version
```

输出示例：


```bash
nvcc: NVIDIA (R) Cuda compiler driver
```

Copyright (c) 2005-2023 NVIDIA Corporation

Built on ...

Cuda compilation tools, release 12.1, V12.1.105

检查 GPU 状态：


```bash
nvidia-smi
```

## ✅ 六、确保 PyTorch 使用 CUDA 12.1

卸载旧版本 PyTorch：


```bash
pip uninstall torch torchvision torchaudio
```

重新安装 PyTorch（对应 CUDA 12.1 版本）：


```bash
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121
```

验证 PyTorch 是否使用 CUDA：


```bash
python -c "import torch; print(torch.__version__); print(torch.cuda.is_available()); print(torch.version.cuda)"
```
