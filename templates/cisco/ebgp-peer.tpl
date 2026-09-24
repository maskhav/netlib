---
title: eBGP пір з фільтрами
vendor: cisco-iosxe
tags: [bgp, ebgp, border]
verify:
  - show ip bgp summary
  - show ip bgp neighbors {{peer_ip}} advertised-routes
  - show ip bgp neighbors {{peer_ip}} received-routes
notes: |
  Завжди вхідний і вихідний фільтр, інакше можна стати транзитом.
  soft-reconfiguration inbound їсть пам'ять, на слабких ISR вмикай свідомо.
vars:
  local_as: {type: asn, hint: "Локальний AS", example: 65001}
  peer_ip: {type: ipv4, hint: "IP сусіда", example: 192.0.2.1}
  peer_as: {type: asn, hint: "AS сусіда", example: 64500}
  peer_name: {type: text, hint: "Опис сусіда", example: ISP1}
  pl_in: {type: text, hint: "Prefix-list на вхід", default: PL-ISP-IN}
  pl_out: {type: text, hint: "Prefix-list на вихід", default: PL-OWN-OUT}
---
router bgp {{local_as}}
 bgp log-neighbor-changes
 neighbor {{peer_ip}} remote-as {{peer_as}}
 neighbor {{peer_ip}} description {{peer_name}}
 !
 address-family ipv4
  neighbor {{peer_ip}} activate
  neighbor {{peer_ip}} prefix-list {{pl_in}} in
  neighbor {{peer_ip}} prefix-list {{pl_out}} out
 exit-address-family
