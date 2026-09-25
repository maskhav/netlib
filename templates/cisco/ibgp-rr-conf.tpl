---
title: BGP Group Router-Reflector config
vendor: cisco-iosxe
tags: [bgp, ibgp, RR]
verify:
  - show ip bgp summary
  - show ip bgp neighbors {{peer_ip}} advertised-routes
  - show ip bgp neighbors {{peer_ip}} received-routes
notes: |
  Конфіга для Роут Рефлектора в ibgp за допомогою групи.
vars:
  local_as: {type: asn, hint: "Локальний AS", example: 65001}
  router_id: {type: ipv4, hint: "Ідентифікатор роутера в BGP", example: 192.0.2.1}
  rr_peer_gr: {type: text, hint: "Назва групи", example: RR-PEER-GROUP}
  update_src: {type: text, hint: "Інтерфейс для сусідства", example: Loopback10}
  peer_ip: {type: ipv4, hint: "IP сусіда", example: 192.0.2.2}
  peer_as: {type: asn, hint: "AS сусіда", example: 64500}
  peer_name: {type: text, hint: "Опис сусіда", example: ISP1}
---
router bgp {{local_as}}
 ip bgp router-id {{router_id}}
 bgp log-neighbor-changes
 neighbor {{rr_peer_gr}} peer-group
 neighbor {{rr_peer_gr}} remote-as {{local_as}}
 neighbor {{rr_peer_gr}} update-source {{update_src}}
 neighbor {{peer_ip}} peer-group {{rr_peer_gr}}
 !
 address-family ipv4
  neighbor {{peer_ip}} activate
 exit-address-family
