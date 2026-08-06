# 决策 0013：固定公网 IP 的可信 HTTPS 基线

状态：accepted
日期：2026-08-06

## 关系导航

- 所属领域：[决策内容地图](00-decisions-map.md)
- 架构结果：[安全与部署边界](../architecture/07-security-and-deployment.md)、[手机 Web 端模块](../architecture/02-mobile-web.md)
- 技术门禁：[技术选型与决策门禁](../architecture/08-technology-selection.md)
- 验收标准：[第一阶段设计就绪验收](../quality/02-phase-1-design-acceptance.md)
- 落实台账：[第一阶段开发入口门禁](../plans/0009-phase-1-entry-gate.md)

## 背景

用户当前没有域名，希望直接通过公网 IP（互联网协议地址）访问手机 Web。可信 HTTPS（安全超文本传输协议）不仅用于防窃听，也决定浏览器是否提供安全 Cookie（浏览器会话凭据）、麦克风等强能力。自签名证书或忽略证书警告不能满足这一目标。

## 决策

- 首版允许使用固定公网 IPv4 作为生产入口，不要求购买域名；IPv6 只在目标主机具有稳定地址并单独通过验证后启用。
- 使用 Caddy v2.11.4 或经验证的更高兼容版本作为唯一公网反向代理，显式选择 Let’s Encrypt（免费公开证书颁发机构）ACME（自动证书管理环境）和 `shortlived`（短期证书）配置档。
- IP 地址客户端通常不发送 SNI（TLS 服务器名称指示），Caddy 必须显式设置 `default_sni` 为当前公网 IP，否则可能出现“证书已签发但普通客户端握手失败”。
- 证书有效期为 160 小时。Caddy 的 `/data` 和 `/config` 使用持久卷；每天检查证书剩余有效期和续期错误，低于 48 小时告警。
- 公网只暴露 80/443，数据库、应用容器和管理端口不直接暴露。生产优先允许 `http-01` 与 `tls-alpn-01` 校验；若 80 被其他服务占用，可在独立验证中只使用 443 的 `tls-alpn-01`。
- 手机 Web 与 API（应用程序接口）同源部署。明文 HTTP 只用于证书校验和跳转，不承载登录、会话或业务正文。

## 已验证证据

2026-08-06 在用户提供的 Ubuntu 24.04 VPS（虚拟专用服务器）上完成隔离验证：

- 目标主机的 80 端口已有其他 Docker（容器运行平台）服务，验证没有覆盖、重启或修改该服务。
- 使用独立 Caddy v2.11.4 容器监听 443，显式选择 `shortlived` 和 `tls-alpn-01`。
- Let’s Encrypt 从多个验证节点完成所有权校验并签发只含目标 IPv4 SAN（主题备用名称）的公开证书。
- 初次普通客户端握手失败；增加 `default_sni` 后根因消除。
- 系统信任校验通过 TLS 1.3、IP 匹配、证书链和 HTTP 200；Caddy 返回了自动续期窗口。

目标 VPS 同时承载另一套业务，因此本次只证明技术路径，不把该服务器直接指定为 ArcMind 正式生产拓扑。若未来共用同一公网 IP 和 443，必须由一个受控边缘代理统一路由；两个独立容器不能同时绑定同一端口。

### 可用性回归

同日后续远程复查时，80 端口上的既有业务仍返回 HTTP 200，443 的 TCP 连接也可以建立，但 Windows SChannel（Windows 安全通道）、.NET 和 Python TLS 客户端都无法完成握手。Python 对 TLS 1.2、TLS 1.3、带 IP SNI、无 SNI 和 443 明文探测均超时；印度、意大利、俄罗斯、瑞典和美国的五个外部 TCP 探测节点也全部超时。因此“历史签发与握手曾通过”仍是有效验证证据，但临时验证入口当前已对多个公网来源不可用，不能继续手机验收或声称持续可用。

当前没有服务器只读状态、容器日志和端口映射证据，根本原因尚未确认。候选原因包括临时容器停止或失去监听、443 映射或防火墙状态变化、Caddy 配置未加载，以及 `default_sni` 回归；确认前不得选定其中任何一项作为结论，也不得通过忽略证书校验掩盖故障。

## 风险与恢复

| 风险 | 控制与恢复 |
|---|---|
| 160 小时证书使续期窗口短 | 持久化证书状态、每日到期检查、48 小时告警；续期失败优先恢复端口可达性和 Caddy 状态 |
| 公网 IP 变化 | 将固定 IP 作为部署前置条件；变化后旧证书和入口立即失效，重新签发并更新客户端入口 |
| 80/443 被占用 | 由唯一边缘代理统一持有端口；不让多个应用各自争抢公网端口 |
| 无 SNI 导致证书选择失败 | 强制 `default_sni`，使用不发送 SNI 的客户端做回归测试 |
| 手机浏览器兼容差异 | iOS Safari、Android Chrome 和目标国产浏览器逐项验收；失败时不降级到明文或忽略警告 |
| Caddy 或证书状态丢失 | 持久卷备份、容器重启验证和可复现配置；不把证书只保存在临时容器层 |

## 替代方案

- 普通域名证书：运维容错更成熟，未来有域名时优先重新评估，但当前不是前置条件。
- 受信任隧道域名：可绕开公网端口和证书管理，但增加第三方运行时依赖，不作为首版默认。
- 受管理私有根证书：只适合所有设备均可安装并维护信任根的封闭场景，不适合作为普通手机访问默认路径。
- 自签名证书或明文 HTTP：禁止用于生产。

## 官方证据

- [Let’s Encrypt：IP 地址证书正式可用](https://letsencrypt.org/2026/01/15/6day-and-ip-general-availability)
- [Let’s Encrypt：短期与 IP 地址证书设计](https://letsencrypt.org/2025/01/16/6-day-and-ip-certs/)
- [Caddy：Automatic HTTPS](https://caddyserver.com/docs/automatic-https)
- [Caddy：Global options](https://caddyserver.com/docs/caddyfile/options)
- [Caddy v2.11.4 发布页](https://github.com/caddyserver/caddy/releases/tag/v2.11.4)
- [MDN（Mozilla 开发者网络）：Secure contexts](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Secure_Contexts)

## 剩余验收

先恢复 443 的正常 TLS 握手并确认根本原因，再由真实手机确认无证书警告、`isSecureContext` 为真、Secure Cookie 正常且麦克风权限可请求。该项通过前，DR-005 保持“部分通过”，不能宣布第一阶段总门禁完成。
