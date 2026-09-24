---
title: eBGP пір з фільтрами
vendor: mikrotik-ros7
tags: [bgp, ebgp, border]
verify:
  - /routing/bgp/session print
  - /ip/route print where bgp
notes: |
  RouterOS 7: фільтри через chain у /routing/filter/rule.
  Без output.filter-chain роутер анонсує все з output.network.
vars:
  conn_name: {type: text, hint: "Імʼя підключення", example: isp1}
  local_as: {type: asn, hint: "Локальний AS", example: 65001}
  peer_ip: {type: ipv4, hint: "IP сусіда", example: 192.0.2.1}
  peer_as: {type: asn, hint: "AS сусіда", example: 64500}
  own_net: {type: cidr, hint: "Власний префікс", example: 203.0.113.0/24}
---
/ip/firewall/address-list add list=bgp-out address={{own_net}}
/routing/filter/rule
add chain={{conn_name}}-in rule="if (dst-len > 24) { reject } else { accept }"
add chain={{conn_name}}-out rule="if (dst in {{own_net}}) { accept } else { reject }"
/routing/bgp/connection
add name={{conn_name}} as={{local_as}} local.role=ebgp \
    remote.address={{peer_ip}} remote.as={{peer_as}} \
    input.filter={{conn_name}}-in output.filter-chain={{conn_name}}-out \
    output.network=bgp-out
