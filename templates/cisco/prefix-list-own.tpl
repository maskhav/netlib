---
title: Prefix-list власних мереж
vendor: cisco-iosxe
tags: [bgp, filter]
verify:
  - show ip prefix-list {{pl_name}}
notes: |
  Останній рядок deny явний, щоб було видно в лічильниках.
vars:
  pl_name: {type: text, hint: "Імʼя prefix-list", default: PL-OWN-OUT}
  own_net: {type: cidr, hint: "Власний префікс", example: 203.0.113.0/24}
---
ip prefix-list {{pl_name}} seq 10 permit {{own_net}}
ip prefix-list {{pl_name}} seq 1000 deny 0.0.0.0/0 le 32
