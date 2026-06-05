---
title: 给 WSL 快捷翻墙
date: 2026-04-16 00:00:00
tags:
  - WSL
  - Clash
  - Codex
categories:
  - 技术文档
cover: /assets/images/covers/tZSMqzWloD3rQamhYv9n1RjZ.jpeg
---

## 给 WSL 快捷翻墙

Clash 开 `ALLOW LAN`。

```bash
export hostip=$(cat /etc/resolv.conf | grep nameserver | awk '{print $2}')
export http_proxy="http://${hostip}:7890"
export https_proxy="http://${hostip}:7890"
```

测试是否连通：

```bash
curl -I https://www.google.com
```

## 在 WSL 里面用 Codex

在 WSL 里直接按顺序执行这几条：

```bash
mkdir -p ~/.vscode-server
cat > ~/.vscode-server/server-env-setup <<'EOF'
#!/bin/sh
HOSTIP=$(awk '/nameserver/ {print $2; exit}' /etc/resolv.conf)
export http_proxy="http://${HOSTIP}:7890"
export https_proxy="http://${HOSTIP}:7890"
export HTTP_PROXY="http://${HOSTIP}:7890"
export HTTPS_PROXY="http://${HOSTIP}:7890"
export ALL_PROXY="http://${HOSTIP}:7890"
export no_proxy="localhost,127.0.0.1,::1"
export NO_PROXY="localhost,127.0.0.1,::1"
EOF
chmod +x ~/.vscode-server/server-env-setup
cat ~/.vscode-server/server-env-setup
```

然后先手动验证 WSL 到 Windows 代理能通：

```bash
curl -I -x http://172.20.48.1:7890 https://auth.openai.com
```

接着在 Windows 里执行：

```bash
wsl --shutdown
```

再重新打开 VS Code，进入 WSL 窗口后重试 Codex 登录。

如果想顺手检查当前 shell 代理，也可以在 WSL 里再执行：

```bash
export HOSTIP=$(awk '/nameserver/ {print $2; exit}' /etc/resolv.conf)
export http_proxy="http://${HOSTIP}:7890"
export https_proxy="http://${HOSTIP}:7890"
export HTTP_PROXY="http://${HOSTIP}:7890"
export HTTPS_PROXY="http://${HOSTIP}:7890"
env | grep -i proxy
```
