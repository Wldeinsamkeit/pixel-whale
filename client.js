window.__ModuleLoader__.load({
  id: '@local/pixel-whale',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const { useEffect, useRef } = React

    // ── 像素小鲸鱼（13×8，朝右）──
    // H 身体  D 深色鳍/尾  L 肚皮  W 眼白  E 瞳孔
    const SPRITE = [
      '.............',
      '.DD..........',
      '..DD...HHHHH.',
      '...DDHHHHHHHH',
      '....HHHWEHHHH',
      '....HHHHHFF..',
      '.....LLLLL...',
      '......LL.....',
    ]
    const PALETTE = {
      H: '#4D6BFE', // 身体
      D: '#3A52C4', // 尾鳍
      L: '#8FA6FF', // 肚皮
      W: '#FFFFFF',
      E: '#10214F',
      F: '#3A52C4', // 侧鳍
    }
    const CELL = 7            // 像素放大倍数
    const SPRITE_W = SPRITE[0].length * CELL
    const SPRITE_H = SPRITE.length * CELL

    function drawWhale(ctx, x, y, dir, blink, wiggle) {
      ctx.save()
      ctx.translate(x + SPRITE_W / 2, y + SPRITE_H / 2)
      if (wiggle > 0) ctx.rotate(Math.sin(wiggle * 0.6) * 0.18)
      ctx.scale(dir, 1)
      ctx.translate(-SPRITE_W / 2, -SPRITE_H / 2)
      for (let row = 0; row < SPRITE.length; row++) {
        for (let col = 0; col < SPRITE[row].length; col++) {
          const ch = SPRITE[row][col]
          if (ch === '.') continue
          let color = PALETTE[ch]
          if (blink && (ch === 'W' || ch === 'E')) color = PALETTE.H // 眨眼时眼睛融入身体
          ctx.fillStyle = color
          ctx.fillRect(col * CELL, row * CELL, CELL, CELL)
        }
      }
      ctx.restore()
    }

    function PetPanel(props) {
      const canvasRef = useRef(null)
      const worldRef = useRef(null)

      useEffect(function () {
        const canvas = canvasRef.current
        if (!canvas) return undefined
        const ctx = canvas.getContext('2d')
        const dpr = window.devicePixelRatio || 1

        function resize() {
          const rect = canvas.parentElement.getBoundingClientRect()
          canvas.width = Math.max(200, rect.width) * dpr
          canvas.height = Math.max(160, rect.height) * dpr
          canvas.style.width = rect.width + 'px'
          canvas.style.height = rect.height + 'px'
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
          const W = Math.max(200, rect.width)
          const H = Math.max(160, rect.height)
          worldRef.current.W = W
          worldRef.current.H = H
          worldRef.current.floor = H - 14
        }

        const world = {
          W: 340, H: 500, floor: 486,
          whale: { x: 60, y: 200, dir: 1, targetX: 260, blink: 0, wiggle: 0 },
          bubbles: [],   // {x,y,r,vy,wob}
          foods: [],     // {x,y,vy,eaten}
          hearts: [],    // {x,y,vy,life}
          nextBubble: 0,
        }
        worldRef.current = world

        resize()
        const ro = new ResizeObserver(resize)
        ro.observe(canvas.parentElement)

        function spawnBubble() {
          const w = world
          w.bubbles.push({
            x: w.whale.x + (w.whale.dir > 0 ? SPRITE_W - 6 : 6) + (Math.random() * 6 - 3),
            y: w.whale.y + 2,
            r: 1.5 + Math.random() * 2,
            vy: 0.35 + Math.random() * 0.3,
            wob: Math.random() * Math.PI * 2,
          })
        }

        function spawnHearts(x, y) {
          for (let i = 0; i < 5; i++) {
            world.hearts.push({
              x: x + (Math.random() * 30 - 15),
              y: y + (Math.random() * 10 - 5),
              vy: -(0.5 + Math.random() * 0.4),
              life: 90 + Math.random() * 30,
            })
          }
        }

        let raf = 0
        let t = 0
        function tick() {
          t += 1
          const w = world
          // ── 鲸鱼游向目标 ──
          const whale = w.whale
          const dx = whale.targetX - whale.x
          const speed = 0.9
          if (Math.abs(dx) > 3) {
            whale.x += Math.sign(dx) * Math.min(speed, Math.abs(dx))
            whale.dir = dx > 0 ? 1 : -1
          } else if (Math.random() < 0.004) {
            whale.targetX = 20 + Math.random() * Math.max(40, w.W - SPRITE_W - 40)
          }
          // 没食物时偶尔换目的地
          if (w.foods.length === 0 && Math.abs(dx) <= 3 && Math.random() < 0.006) {
            whale.targetX = 20 + Math.random() * Math.max(40, w.W - SPRITE_W - 40)
          }
          // 有食物 → 冲向最近的
          let nearest = null
          for (const f of w.foods) {
            if (f.eaten) continue
            if (!nearest || Math.abs(f.x - whale.x) < Math.abs(nearest.x - whale.x)) nearest = f
          }
          if (nearest) {
            const fdx = nearest.x - (whale.x + SPRITE_W / 2)
            if (Math.abs(fdx) > 4) {
              whale.x += Math.sign(fdx) * 1.6
              whale.dir = fdx > 0 ? 1 : -1
            } else if (Math.abs(nearest.y - (whale.y + SPRITE_H / 2)) < 26) {
              nearest.eaten = true
              spawnHearts(nearest.x, nearest.y)
            }
          }
          const bob = Math.sin(t * 0.02) * 7
          // ── 泡泡 ──
          w.nextBubble -= 1
          if (w.nextBubble <= 0) {
            spawnBubble()
            w.nextBubble = 80 + Math.random() * 140
          }
          for (const b of w.bubbles) {
            b.y -= b.vy
            b.x += Math.sin(t * 0.05 + b.wob) * 0.3
          }
          w.bubbles = w.bubbles.filter((b) => b.y > 8)
          // ── 食物 ──
          for (const f of w.foods) {
            if (f.y < w.floor - 4) f.y += Math.min(1.6, w.floor - 4 - f.y)
          }
          w.foods = w.foods.filter((f) => !f.eaten)
          // ── 爱心 ──
          for (const hh of w.hearts) {
            hh.y += hh.vy
            hh.life -= 1
          }
          w.hearts = w.hearts.filter((hh) => hh.life > 0)
          // ── 眨眼 ──
          if (whale.blink > 0) whale.blink -= 1
          else if (Math.random() < 0.005) whale.blink = 12
          if (whale.wiggle > 0) whale.wiggle -= 1

          // ── 绘制 ──
          ctx.clearRect(0, 0, w.W, w.H)
          const grad = ctx.createLinearGradient(0, 0, 0, w.H)
          grad.addColorStop(0, '#0B1230')
          grad.addColorStop(1, '#101B45')
          ctx.fillStyle = grad
          ctx.fillRect(0, 0, w.W, w.H)
          // 水面像素波纹
          ctx.fillStyle = '#1B2A5E'
          for (let px = 0; px < w.W; px += 8) {
            const off = Math.floor(Math.sin(t * 0.03 + px * 0.08) * 2)
            ctx.fillRect(px, 6 + off, 8, 4)
          }
          // 沙底
          ctx.fillStyle = '#2A3563'
          ctx.fillRect(0, w.floor, w.W, w.H - w.floor)
          ctx.fillStyle = '#37457E'
          for (let px = 4; px < w.W; px += 12) ctx.fillRect(px, w.floor + 4, 6, 3)
          // 泡泡（像素方块）
          for (const b of w.bubbles) {
            ctx.fillStyle = 'rgba(143,166,255,0.75)'
            const r = Math.max(2, Math.round(b.r))
            ctx.fillRect(Math.round(b.x), Math.round(b.y), r, r)
            ctx.fillStyle = 'rgba(255,255,255,0.9)'
            ctx.fillRect(Math.round(b.x), Math.round(b.y), 1, 1)
          }
          // 食物（橙色像素粒）
          for (const f of w.foods) {
            ctx.fillStyle = '#FF9F0A'
            ctx.fillRect(Math.round(f.x) - 2, Math.round(f.y), 4, 4)
            ctx.fillStyle = '#FFC866'
            ctx.fillRect(Math.round(f.x) - 1, Math.round(f.y), 2, 2)
          }
          // 鲸鱼
          drawWhale(ctx, whale.x, whale.y + bob, whale.dir, whale.blink > 0, whale.wiggle)
          // 爱心（像素心：两个方块+一个尖）
          for (const hh of w.hearts) {
            ctx.fillStyle = 'rgba(255,105,135,' + Math.min(1, hh.life / 40) + ')'
            ctx.fillRect(Math.round(hh.x) - 3, Math.round(hh.y), 2, 2)
            ctx.fillRect(Math.round(hh.x) + 1, Math.round(hh.y), 2, 2)
            ctx.fillRect(Math.round(hh.x) - 2, Math.round(hh.y) + 2, 4, 2)
            ctx.fillRect(Math.round(hh.x) - 1, Math.round(hh.y) + 4, 2, 1)
          }
          raf = requestAnimationFrame(tick)
        }
        raf = requestAnimationFrame(tick)

        // ── 交互 ──
        function onClick(ev) {
          const rect = canvas.getBoundingClientRect()
          const x = ev.clientX - rect.left
          const y = ev.clientY - rect.top
          const whale = world.whale
          const wy = whale.y + Math.sin(t * 0.02) * 7
          const onWhale = x >= whale.x && x <= whale.x + SPRITE_W && y >= wy && y <= wy + SPRITE_H
          if (onWhale) {
            whale.wiggle = 40
            spawnHearts(whale.x + SPRITE_W / 2, wy)
          } else if (y < world.floor && y > 24) {
            world.foods.push({ x, y, eaten: false })
          }
        }
        canvas.addEventListener('click', onClick)

        return function cleanup() {
          cancelAnimationFrame(raf)
          ro.disconnect()
          canvas.removeEventListener('click', onClick)
        }
      }, [])

      const t = props.t
      return h('section', {
        className: 'pw-root',
        style: {
          position: 'relative', display: 'flex', flexDirection: 'column',
          height: '100%', minHeight: 0, background: '#0B1230',
          color: 'var(--dsw-alias-label-primary)',
          fontFamily: '-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif',
        },
        'aria-label': t('title'),
      },
        h('style', null, '.pw-root canvas{cursor:pointer;display:block}'),
        h('header', {
          style: {
            flex: 'none', display: 'flex', alignItems: 'center', gap: 10,
            padding: '11px 28px', borderBottom: '1px solid rgba(255,255,255,0.08)',
          },
        },
          h('span', {
            style: {
              width: 26, height: 26, borderRadius: 8, background: 'rgba(77,107,254,0.2)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 15,
            },
          }, '🐳'),
          h('div', null,
            h('div', { style: { fontSize: 13, fontWeight: 600, lineHeight: 1.25 } }, 'Pixel Whale'),
            h('div', { style: { fontSize: 11, marginTop: 2, color: 'rgba(255,255,255,0.55)' } }, t('hint'))
          )
        ),
        h('div', { style: { flex: '1 1 auto', minHeight: 0, position: 'relative' } },
          h('canvas', { ref: canvasRef })
        )
      )
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        const locale = ctx.get('locale')
        const DICTS = {
          zh: { title: 'Pixel Whale', hint: '点水面投食 · 点鲸鱼摸摸它' },
          en: { title: 'Pixel Whale', hint: 'Click water to feed · click whale to pet' },
        }
        if (locale && typeof locale.register === 'function') {
          Object.keys(DICTS).forEach(function (id) {
            ctx.effect(function () { return locale.register('pixel-whale', id, DICTS[id]) }, 'pixel-whale: ' + id)
          })
        }
        const translate = locale && typeof locale.bind === 'function' ? locale.bind('pixel-whale') : fallback
        function fallback(key) { return (DICTS.zh[key] || DICTS.en[key] || key) }
        const Panel = function (props) { return h(PetPanel, Object.assign({}, props, { t: translate })) }

        ctx.slots.inject('sidebar.panellist', function () {
          return ctx.slots.register({
            name: 'sidebar.panellist', id: 'pixel-whale', order: 26,
            label: function () { return translate('title') },
          }, function (props) {
            const size = props && typeof props.size === 'number' ? props.size : 20
            return h('svg', {
              viewBox: '0 0 13 13', width: size, height: size,
              shapeRendering: 'crispEdges', style: { display: 'block' }, 'aria-hidden': true,
            },
              h('rect', { x: 1, y: 3.5, width: 2, height: 2, fill: 'currentColor', opacity: 0.75 }),
              h('rect', { x: 3, y: 4.5, width: 8, height: 3, fill: 'currentColor' }),
              h('rect', { x: 9, y: 5.5, width: 1, height: 1, fill: 'var(--dsw-alias-bg-base, #fff)' }),
              h('rect', { x: 4, y: 7.5, width: 6, height: 1, fill: 'currentColor', opacity: 0.6 })
            )
          })
        })
        ctx.slots.inject('main', function () {
          return ctx.slots.register({ name: 'main', key: 'pixel-whale' }, Panel)
        })
      },
    }
  },
})
