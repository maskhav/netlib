---
title: SVI interface config
vendor: cisco-iosxe
tags: [svi, vlan, interface]
verify:
  - show run int vlan{{vlan_id}}
  - show ip int br | inc vlan{{vlan_id}}
notes: |
  Конфіга для SVI інтерфейсу влана.
vars:
  vlan_id: {type: int, hint: "Номер влану", example: 10}
  description: {type: text, hint: "Опис інтерфейсу", example: ServiceA}
  host_ip: {type: ipv4, hint: "IP-адреса інтерфейсу", example: 192.168.2.1}
  net_mask: {type: ipv4, hint: "Маска мережі", example: 255.255.255.0}
---
interface vlan {{vlan_id}}
 description {{description}}
 ip address {{host_ip}} {{net_mask}}
 no sh
 exit