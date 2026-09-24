---
title: VRRPv3 на SVI
vendor: cisco-iosxe
tags: [fhrp, vrrp]
verify:
  - show vrrp brief
notes: |
  На Catalyst 9200 спершу fhrp version vrrp v3 глобально.
vars:
  vlan: {type: int, hint: "VLAN", example: 10}
  svi_ip: {type: ipv4, hint: "IP інтерфейсу"}
  mask: {type: mask, hint: "Маска", default: 255.255.255.0}
  vrid: {type: int, hint: "VRID", default: 1}
  vip: {type: ipv4, hint: "Віртуальний IP"}
  prio: {type: int, hint: "Пріоритет", default: 110}
---
fhrp version vrrp v3
interface Vlan{{vlan}}
 ip address {{svi_ip}} {{mask}}
 vrrp {{vrid}} address-family ipv4
  address {{vip}} primary
  priority {{prio}}
  preempt delay minimum 30
 exit-vrrp
