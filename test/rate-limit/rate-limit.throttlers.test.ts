import { ExecutionContext } from '@nestjs/common'
import { cleDuThrottler } from '../../src/rate-limit/rate-limit.throttlers'

describe('cleDuThrottler', () => {
  const context = {} as ExecutionContext

  it('ramène une IPv6 compressée à son /64', () => {
    expect(cleDuThrottler(context, '2001:db8:1:2:3:4:5:6', 'ip')).toBe(
      'rate-limit:ip:2001:db8:1:2::/64'
    )
  })

  it('ramène une IPv6 complète au même /64 que sa forme compressée', () => {
    expect(
      cleDuThrottler(
        context,
        '2001:0DB8:0001:0002:0000:0000:0000:0001',
        'ip-token'
      )
    ).toBe(cleDuThrottler(context, '2001:db8:1:2::1', 'ip-token'))
  })

  it('traite une IPv4 mappée comme son IPv4', () => {
    expect(cleDuThrottler(context, '::ffff:1.2.3.4', 'ip')).toBe(
      'rate-limit:ip:1.2.3.4'
    )
  })

  it('garde une IPv4 telle quelle', () => {
    expect(cleDuThrottler(context, '1.2.3.4', 'ip')).toBe(
      'rate-limit:ip:1.2.3.4'
    )
  })

  it("garde telle quelle une valeur qui n'est pas une IP", () => {
    expect(cleDuThrottler(context, 'pas-une-ip', 'ip')).toBe(
      'rate-limit:ip:pas-une-ip'
    )
    expect(cleDuThrottler(context, 'global', 'creation-invite')).toBe(
      'rate-limit:creation-invite:global'
    )
  })
})
