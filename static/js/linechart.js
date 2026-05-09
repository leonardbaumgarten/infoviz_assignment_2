/**
 * linechart.js – Time-series line chart
 *
 * Renders a line chart for a selected country and indicator over all years.
 * Exposed:  initLineChart(), updateLineChart(countryName, indicator)
 */

'use strict';

/* ── Layout ───────────────────────────────────────────────────────────────── */
const LC_MARGIN = { top: 20, right: 30, bottom: 40, left: 64 };

/* ── Module state ─────────────────────────────────────────────────────────── */
let lcSvg = null;
let lcG   = null;
let lcW, lcH;
let lcXScale, lcYScale;
let lcXAxis, lcYAxis;
let lcLine, lcArea;
let lcPath, lcAreaPath, lcCircles;
let lcTip;

/* ── Tooltip ─────────────────────────────────────────────────────────────── */
function createLcTooltip() {
    lcTip = d3.select('#svg_line_plot').append('div')
        .attr('class', 'tooltip')
        .attr('id', 'lc-tooltip');
}

/* ── initLineChart ────────────────────────────────────────────────────────── */
function initLineChart() {
    const container = document.getElementById('svg_line_plot');
    const totalW = container.clientWidth  || 900;
    const totalH = container.clientHeight || 280;

    lcW = totalW - LC_MARGIN.left - LC_MARGIN.right;
    lcH = totalH - LC_MARGIN.top  - LC_MARGIN.bottom;

    lcSvg = d3.select('#svg_line_plot')
        .append('svg')
        .attr('width',  totalW)
        .attr('height', totalH);

    // Gradient definition
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

    lcG = lcSvg.append('g')
        .attr('transform', `translate(${LC_MARGIN.left},${LC_MARGIN.top})`);

    // Clip path
    defs.append('clipPath').attr('id', 'lc-clip')
        .append('rect').attr('width', lcW).attr('height', lcH);

    // Scales (will be updated per data)
    lcXScale = d3.scaleLinear().range([0, lcW]);
    lcYScale = d3.scaleLinear().range([lcH, 0]);

    // Axis containers
    lcG.append('g').attr('class', 'x-axis axis').attr('transform', `translate(0,${lcH})`);
    lcG.append('g').attr('class', 'y-axis axis');

    // Grid
    lcG.append('g').attr('class', 'lc-grid-h');
    lcG.append('g').attr('class', 'lc-grid-v');

    // Area + line (with clip)
    const clipG = lcG.append('g').attr('clip-path', 'url(#lc-clip)');

    lcAreaPath = clipG.append('path').attr('class', 'line-area');
    lcPath     = clipG.append('path').attr('class', 'line-path');
    lcCircles  = clipG.append('g').attr('class', 'lc-circles');

    // Axis labels
    lcG.append('text').attr('class', 'axis-label').attr('id', 'lc-y-label')
        .attr('transform', 'rotate(-90)')
        .attr('x', -lcH / 2).attr('y', -52)
        .attr('text-anchor', 'middle');

    lcG.append('text').attr('class', 'axis-label')
        .attr('x', lcW / 2).attr('y', lcH + 36)
        .attr('text-anchor', 'middle').text('Year');

    // Tooltip
    lcTip = d3.select('body').append('div')
        .attr('class', 'tooltip')
        .attr('id', 'lc-tooltip');
}

/* ── updateLineChart ──────────────────────────────────────────────────────── */
function updateLineChart(countryName, indicator) {
    if (!lcSvg || !countryName || !indicator) return;

    // Filter & sort data
    const raw = allData
        .filter(d => d.Name === countryName && d[indicator] !== null && d[indicator] !== undefined && !isNaN(d[indicator]))
        .sort((a, b) => a.Year - b.Year);

    if (raw.length === 0) {
        lcPath.attr('d', null);
        lcAreaPath.attr('d', null);
        lcCircles.selectAll('*').remove();
        d3.select('#line-subtitle').text(`No data for "${indicator}" in ${countryName}`);
        return;
    }

    // Update subtitle
    d3.select('#line-subtitle').text(`${countryName} · ${indicator}`);

    // Update scales
    lcXScale.domain(d3.extent(raw, d => d.Year));
    const [yLo, yHi] = d3.extent(raw, d => +d[indicator]);
    const yPad = (yHi - yLo) * 0.1 || 1;
    lcYScale.domain([yLo - yPad, yHi + yPad]);

    // Update axes
    const xAxis = d3.axisBottom(lcXScale).ticks(8).tickFormat(d3.format('d')).tickSize(-lcH);
    const yAxis = d3.axisLeft(lcYScale).ticks(5).tickSize(-lcW);
    const fmt   = yHi > 1e6 ? '.2s' : yHi > 100 ? ',.0f' : '.3f';
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

    const areaGen = d3.area()
        .x(d => lcXScale(d.Year))
        .y0(lcH)
        .y1(d => lcYScale(+d[indicator]))
        .curve(d3.curveCatmullRom.alpha(0.5));

    lcPath.datum(raw)
        .transition().duration(500)
        .attr('d', lineGen);

    lcAreaPath.datum(raw)
        .transition().duration(500)
        .attr('d', areaGen);

    // Dots
    const circles = lcCircles.selectAll('circle').data(raw, d => d.Year);
    circles.enter().append('circle')
        .attr('class', 'line-dot')
        .attr('cx', d => lcXScale(d.Year))
        .attr('cy', d => lcYScale(+d[indicator]))
        .attr('r', 3.5)
        .attr('fill', '#6c8aff')
        .on('mouseover', function (event, d) {
            const fmt2 = Math.abs(+d[indicator]) > 1e6 ? '.3s' : Math.abs(+d[indicator]) > 100 ? ',.0f' : '.3f';
            lcTip.html(`
                <div class="tt-country">${d.Year}</div>
                <div class="tt-value"><span>${d3.format(fmt2)(+d[indicator])}</span></div>
            `).classed('visible', true);
            const [mx, my] = d3.pointer(event, document.body);
            lcTip.style('left', `${mx + 14}px`).style('top', `${my - 10}px`);
        })
        .on('mouseout', () => lcTip.classed('visible', false))
        .merge(circles)
        .transition().duration(500)
        .attr('cx', d => lcXScale(d.Year))
        .attr('cy', d => lcYScale(+d[indicator]));

    circles.exit().remove();
}
