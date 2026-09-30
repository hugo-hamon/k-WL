"""Optional Playwright smoke test against an already running Eel app."""
import os
from playwright.sync_api import sync_playwright, expect

with sync_playwright() as p:
    browser = p.chromium.launch(args=['--enable-unsafe-swiftshader'])
    page = browser.new_page(viewport={'width': 1440, 'height': 1000})
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(os.environ.get('WL_TEST_URL', 'http://localhost:8000'), wait_until='networkidle')
    expect(page.locator('#status-info')).to_have_text('1-WL prêt.', timeout=20000)
    page.evaluate("async () => { window.v = (await import('/js/index.js')).graphVisualizerInstance; }")
    page.locator('#edge-list-input').fill('[(0,1),(1,2),(2,3)]\n[(0,1),(1,2),(2,3)]')
    page.locator('#load-graph-btn').click()
    expect(page.locator('#status-info')).to_have_text('1-WL prêt.')
    page.locator('#k-value').select_option('2')
    expect(page.locator('.fwl-graph')).to_have_count(2)
    expect(page.locator('.color-matrix')).to_have_count(2)
    expect(page.locator('#fwl-panel input, #fwl-panel select, .matrix-detail, .fwl-formula, .fwl-comparison')).to_have_count(0)
    page.locator('#iterate-btn').click()
    expect(page.locator('.color-matrix')).to_have_count(4)
    expect(page.locator('#iteration-info')).to_have_text('Iteration: 1')
    page.wait_for_function('v.fwl.views.every(view => view.data)')
    assert page.evaluate('JSON.stringify(v.fwl.views[1].data.current) === JSON.stringify(v.fwl.views[3].data.current)')
    assert page.evaluate('v.fwl.views.every(view => view.data.current.every((row,i,m) => row.every((c,j) => c === m[j][i])))')
    # Verify actual canvas pixels, not just backend data, are symmetric.
    assert page.evaluate('''() => {
        const canvas = document.querySelectorAll('.color-matrix')[1], ctx = canvas.getContext('2d');
        const pixel = (i,j) => [...ctx.getImageData((j+1)*29+3, (i+1)*29+3, 1, 1).data].join(',');
        return pixel(0,1) === pixel(1,0) && pixel(0,1) !== pixel(0,0);
    }''')
    first = page.locator('.color-matrix').nth(1)
    first.hover(position={'x': 72, 'y': 43})
    assert page.evaluate('v.hoveredPair') == [0, 1]
    assert page.evaluate('v.currentGraphData.links.filter(l => v.graphInstance.linkWidth()(l) === 5).length') == 1
    first.focus(); page.keyboard.press('ArrowRight')
    assert page.evaluate('v.hoveredPair') == [0, 1]
    # Each graph has its own matrices without a selector; hover the second graph.
    second = page.locator('.color-matrix').nth(3)
    second.hover(position={'x': 72, 'y': 43})
    assert page.evaluate('v.hoveredPair') == [4, 5]
    page.locator('#toggle-mode-btn').click()
    expect(page.locator('#toggle-mode-btn')).to_have_text('Switch to 2D')
    second.hover(position={'x': 72, 'y': 43})
    assert page.evaluate('v.is3D && v.currentGraphData.links.filter(l => v.graphInstance.linkWidth()(l) === 5).length === 1')
    page.screenshot(path='/tmp/kwl-3d.png')
    page.locator('#toggle-mode-btn').click()
    # Large matrices: natural scrolling, fixed-size canvas, automatic window loading.
    page.locator('#edge-list-input').fill(str([(i, i + 1) for i in range(220)]))
    page.locator('#load-graph-btn').click()
    expect(page.locator('#iteration-info')).to_have_text('Iteration: 0')
    expect(page.locator('.color-matrix')).to_have_count(1)
    page.wait_for_function('v.fwl.views[0].data?.current.length === 40')
    page.locator('.matrix-scroll').evaluate('(el) => { el.scrollTop = 190*29; el.scrollLeft = 190*29; }')
    page.wait_for_function('v.fwl.views[0].row === 190 && v.fwl.views[0].column === 190')
    page.locator('.color-matrix').hover(position={'x': 72, 'y': 43})
    assert page.evaluate('v.hoveredPair') == [190, 191]
    assert page.evaluate('v.fwl.views[0].canvas.width <= 1100 && v.fwl.views[0].canvas.height <= 480')
    page.locator('#iterate-btn').click()
    expect(page.locator('#status-info')).to_contain_text('trop coûteuse')
    assert page.evaluate('v.fwl.views[0].data.current.length') == 31
    # Disconnected pairs remain excluded; all input graphs, including empty, appear.
    page.locator('#edge-list-input').fill('[(0,1,2),(1,2),(3,4),(8,)]\n[(0,1),(1,2),(2,0)]\n[]')
    page.locator('#load-graph-btn').click()
    expect(page.locator('#status-info')).to_have_text('2-FWL prêt.')
    expect(page.locator('.fwl-graph')).to_have_count(3)
    expect(page.locator('.color-matrix')).to_have_count(2)
    page.locator('.color-matrix').first.hover(position={'x': 130, 'y': 43})
    assert page.evaluate('v.hoveredPair') is None
    page.locator('#iterate-btn').click()
    expect(page.locator('.color-matrix')).to_have_count(4)
    page.wait_for_function('!v.busy && v.fwl.views.every(view => view.data)')
    page.locator('#info-panel').evaluate('(el) => el.scrollTop = 0')
    page.screenshot(path='/tmp/kwl-desktop.png')
    page.set_viewport_size({'width': 390, 'height': 844})
    page.locator('.fwl-graph').first.scroll_into_view_if_needed()
    page.screenshot(path='/tmp/kwl-mobile.png')
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    page.locator('#k-value').select_option('1')
    expect(page.locator('#iteration-info')).to_have_text('Iteration: 0')
    page.locator('#iterate-btn').click()
    expect(page.locator('#iteration-info')).to_have_text('Iteration: 1')
    assert not errors, errors
    print('Browser checks passed: simultaneous symmetric matrices, removed controls, hover 2D/3D, keyboard, automatic scrolling, limits, empty/disconnected graphs, mobile, 1-WL.')
    browser.close()
