/**
 * linechart.js – Time-series line chart (Tasks 5 & 6)
 *
 * Supports both single-country display (map click) and multi-country
 * display (brush selection).  Uses proper enter/update/exit pattern.
 *
 * Exports: initLineChart(), updateLineChart(countryName, indicator),
 *          updateLineChartMulti(nameArray, indicator), clearLineChart()
 */

'use strict';

/* ── Layout ───────────────────────────────────────────────────────────────── */
const LC_MARGIN = { top: 20, right: 30, bottom: 40, left: 64 };

/* ── A small colour palette for multi-country lines ──────────────────────── */
const LC_COLORS = [
    '#6c8aff', '#34d399', '#f59e0b', '#ec4899', '#a78bfa',
    '#fb923c', '#22d3ee', '#f87171', '#4ade80', '#818cf8'
];

/* ── Module state ─────────────────────────────────────────────────────────── */
let lcSvg = null;
let lcG = null;
let lcW, lcH;
let lcXScale, lcYScale;
let lcClipG;
let lcLinesG, lcDotsG;
let lcTip;

/* ── initLineChart ────────────────────────────────────────────────────────── */
function initLineChart() {
    const container = document.getElementById('svg_line_plot');
    const totalW = container.clientWidth || 900;
    const totalH = container.clientHeight || 280;

    lcW = totalW - LC_MARGIN.left - LC_MARGIN.right;
    lcH = totalH - LC_MARGIN.top - LC_MARGIN.bottom;

    lcSvg = d3.select('#svg_line_plot')
        .append('svg')
        .attr('width', totalW)
        .attr('height', totalH);

    // Gradient
    const defs = lcSvg.append('defs');
    const grad = defs.append('linearGradient')
        .attr('id', 'area-gradient')
        .attr('gradientUnits', 'userSpaceOnUse')
        .attr('x1', 0).attr('y1', 0)
        .attr('x2', 0).attr('y2', lcH);
    grad.append('stop').attr('offset', '0%')
        .attr('stop-color', '#6c8aff').attr('stop-opacity', 0.5);
    grad.append('stop').attr('offset', '100%')
        .attr('stop-color', '#6c8aff').attr('stop-opacity', 0);

    // Clip path
    defs.append('clipPath').attr('id', 'lc-clip')
        .append('rect').attr('width', lcW).attr('height', lcH);

    lcG = lcSvg.append('g')
        .attr('transform', `translate(${LC_MARGIN.left},${LC_MARGIN.top})`);

    // Scales
    lcXScale = d3.scaleLinear().range([0, lcW]);
    lcYScale = d3.scaleLinear().range([lcH, 0]);

    // Axes containers
    lcG.append('g').attr('class', 'x-axis axis').attr('transform', `translate(0,${lcH})`);
    lcG.append('g').attr('class', 'y-axis axis');

    // Grid
    lcG.append('g').attr('class', 'lc-grid-h');

    // Clipped drawing area
    lcClipG = lcG.append('g').attr('clip-path', 'url(#lc-clip)');
    lcLinesG = lcClipG.append('g').attr('class', 'lc-lines-container');
    lcDotsG = lcClipG.append('g').attr('class', 'lc-dots-container');

    // Axis labels
    lcG.append('text').attr('class', 'axis-label').attr('id', 'lc-y-label')
        .attr('transform', 'rotate(-90)')
        .attr('x', -lcH / 2).attr('y', -52)
        .attr('text-anchor', 'middle');

    lcG.append('text').attr('class', 'axis-label')
        .attr('x', lcW / 2).attr('y', lcH + 36)
        .attr('text-anchor', 'middle').text('Year');

    // Legend container for multi-country
    lcG.append('g').attr('class', 'lc-legend')
        .attr('transform', `translate(${lcW - 10},10)`);

    // Tooltip
    lcTip = d3.select('body').append('div')
        .attr('class', 'tooltip')
        .attr('id', 'lc-tooltip');
}

/* ── Single-country update (map click) ────────────────────────────────────── */
function updateLineChart(countryName, indicator) {
    updateLineChartMulti([countryName], indicator);
}

/* ── Multi-country update (brush / single click) ─────────────────────────── */
function updateLineChartMulti(nameArray, indicator) {
    if (!lcSvg || !nameArray || nameArray.length === 0 || !indicator) return;

    // Build per-country data arrays
    const series = nameArray.map((name, i) => {
        const raw = allData
            .filter(d => d.Name === name && d[indicator] != null && !isNaN(d[indicator]))
            .sort((a, b) => a.Year - b.Year);
        return { name, data: raw, color: LC_COLORS[i % LC_COLORS.length] };
    }).filter(s => s.data.length > 0);

    if (series.length === 0) {
        clearLineChart();
        d3.select('#line-subtitle').text(`No data for "${indicator}"`);
        return;
    }

    // Subtitle
    const subtitle = series.map(s => s.name).join(', ');
    d3.select('#line-subtitle').text(
        (subtitle.length > 80 ? subtitle.substring(0, 80) + '…' : subtitle) + ' · ' + indicator
    );

    // All data points concatenated for computing scale domains
    const allPts = series.flatMap(s => s.data);

    // Update scales
    lcXScale.domain(d3.extent(allPts, d => d.Year));
    const [yLo, yHi] = d3.extent(allPts, d => +d[indicator]);
    const yPad = (yHi - yLo) * 0.1 || 1;
    lcYScale.domain([yLo - yPad, yHi + yPad]);

    // Update axes (transition, no redraw)
    const xAxis = d3.axisBottom(lcXScale).ticks(8).tickFormat(d3.format('d')).tickSize(-lcH);
    const yAxis = d3.axisLeft(lcYScale).ticks(5).tickSize(-lcW);
    const fmt = yHi > 1e6 ? '.2s' : yHi > 100 ? ',.0f' : '.3f';
    yAxis.tickFormat(d3.format(fmt));

    lcG.select('.x-axis').transition().duration(400).call(xAxis).select('.domain').remove();
    lcG.select('.y-axis').transition().duration(400).call(yAxis).select('.domain').remove();

    // Grid
    lcG.select('.lc-grid-h').selectAll('line')
        .data(lcYScale.ticks(5)).join('line')
        .attr('class', 'grid-line')
        .attr('x1', 0).attr('x2', lcW)
        .attr('y1', d => lcYScale(d)).attr('y2', d => lcYScale(d));

    // Y-axis label
    const labelText = indicator.length > 45 ? indicator.substring(0, 45) + '…' : indicator;
    d3.select('#lc-y-label').text(labelText);

    // Line generator
    const lineGen = d3.line()
        .x(d => lcXScale(d.Year))
        .y(d => lcYScale(+d[indicator]))
        .curve(d3.curveCatmullRom.alpha(0.5));

    /* ── Lines – enter/update/exit ────────────────────────────────────────── */
    const lineSel = lcLinesG.selectAll('path.lc-series-line')
        .data(series, d => d.name);

    // Enter
    lineSel.enter().append('path')
        .attr('class', 'lc-series-line')
        .attr('fill', 'none')
        .attr('stroke', d => d.color)
        .attr('stroke-width', 2.5)
        .attr('stroke-linecap', 'round')
        .attr('stroke-linejoin', 'round')
        .attr('d', d => lineGen(d.data));

    // Update
    lineSel.transition().duration(500)
        .attr('stroke', d => d.color)
        .attr('d', d => lineGen(d.data));

    // Exit
    lineSel.exit().transition().duration(200).style('opacity', 0).remove();

    /* ── Dots – enter/update/exit ─────────────────────────────────────────── */
    // Flatten series into individual point data
    const ptData = series.flatMap(s =>
        s.data.map(d => ({ ...d, _key: s.name + '-' + d.Year, _color: s.color }))
    );

    const dotSel = lcDotsG.selectAll('circle.lc-pt')
        .data(ptData, d => d._key);

    // Enter
    dotSel.enter().append('circle')
        .attr('class', 'lc-pt line-dot')
        .attr('r', 3)
        .attr('fill', d => d._color)
        .attr('cx', d => lcXScale(d.Year))
        .attr('cy', d => lcYScale(+d[indicator]))
        .on('mouseover', function (event, d) {
            const fmt2 = Math.abs(+d[indicator]) > 1e6 ? '.3s' : Math.abs(+d[indicator]) > 100 ? ',.0f' : '.3f';
            lcTip.html(`
                <div class="tt-country">${d.Name} · ${d.Year}</div>
                <div class="tt-value"><span>${d3.format(fmt2)(+d[indicator])}</span></div>
            `).classed('visible', true);
            const [mx, my] = d3.pointer(event, document.body);
            lcTip.style('left', `${mx + 14}px`).style('top', `${my - 10}px`);
        })
        .on('mouseout', () => lcTip.classed('visible', false));

    // Update
    dotSel.transition().duration(500)
        .attr('fill', d => d._color)
        .attr('cx', d => lcXScale(d.Year))
        .attr('cy', d => lcYScale(+d[indicator]));

    // Exit
    dotSel.exit().transition().duration(200).style('opacity', 0).remove();

    /* ── Legend (enter/update/exit) ────────────────────────────────────────── */
    if (series.length > 1) {
        const legG = lcG.select('.lc-legend');
        const legItems = legG.selectAll('g.lc-legend-item')
            .data(series, d => d.name);

        const enter = legItems.enter().append('g')
            .attr('class', 'lc-legend-item')
            .attr('transform', (d, i) => `translate(0, ${i * 16})`);
        enter.append('rect').attr('width', 10).attr('height', 10).attr('rx', 2);
        enter.append('text').attr('x', -6).attr('y', 9)
            .attr('class', 'axis-label')
            .attr('text-anchor', 'end');

        const merged = enter.merge(legItems)
            .attr('transform', (d, i) => `translate(0, ${i * 16})`);
        merged.select('rect').attr('fill', d => d.color);
        merged.select('text').text(d => d.name.length > 18 ? d.name.substring(0, 18) + '…' : d.name);

        legItems.exit().remove();
    } else {
        lcG.select('.lc-legend').selectAll('*').remove();
    }
}

/* ── Clear the line chart ─────────────────────────────────────────────────── */
function clearLineChart() {
    if (!lcLinesG) return;
    lcLinesG.selectAll('*').transition().duration(200).style('opacity', 0).remove();
    lcDotsG.selectAll('*').transition().duration(200).style('opacity', 0).remove();
    lcG.select('.lc-legend').selectAll('*').remove();
    d3.select('#line-subtitle').text('Select a country on the map or brush in the scatterplot');
}
