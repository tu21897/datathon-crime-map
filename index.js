// coordinates for seattle to center the map
const home = {lat: 47.646197, long:-122.312542, zoom:13};
const currentHighlighted = document.querySelector('.cc');
const currentCount = document.querySelector('.mcpp-count');

// base map element on the DOM
let map = L.map('map', {
                    zoomControl: false,
                    minZoom: 10
                }).setView([home.lat, home.long], home.zoom);

d3.json('mcpp.geojson').then(async function(json) {
    let mcppCountsSorted = [];
    let mcppCounts = {};

    const getMapData = async (date1, date2) => {
        mcppCounts = {};
        const startTime = picker.getStartDate().dateInstance.toISOString().slice(0,10);
        const endTime = picker.getEndDate().dateInstance.toISOString().slice(0,10);
        const response = await fetch(`https://data.seattle.gov/resource/tazs-3rd5.json?$where=offense_start_datetime%20%3E=%20%27${startTime}T00:00:00%27%20and%20offense_start_datetime%3C=%27${endTime}T00:00:00%27&$limit=${10000000}`);
        const data = await response.json();
        data.forEach(d => {mcppCounts[d.mcpp] ? (mcppCounts[d.mcpp] += 1):(mcppCounts[d.mcpp] = 1)});
        let mcppOffCounts = {};
        data.forEach(d => {mcppOffCounts[d.offense] ? (mcppOffCounts[d.offense] += 1):(mcppOffCounts[d.offense] = 1)});
        console.log(mcppOffCounts);
        return Object.entries(mcppCounts).map(d => new Object({name:d[0], count:d[1]})).sort((a,b) => b.count-a.count);
    }

    const picker = new Litepicker({ 
        element: document.getElementById('litepicker'),
        singleMode: false,
        position: 'top left',
        startDate: new Date('2019-01-01'),
        endDate: new Date('2020-01-01'),
        plugins: ['ranges'],
        setup: (picker) => {
            picker.on('selected', async (date1, date2) => {
                renderMap();
            });
        }
    });
    
    const renderMap = async () => {
        map.remove();
        map = L.map('map', {
                zoomControl: false,
                minZoom: 10
            }).setView([home.lat, home.long], home.zoom);
        // leaflet map overlay
        L.tileLayer('https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png', {
            maxZoom: 20
        }).addTo(map);
        L.svg({clickable:true}).addTo(map);

        const projectPoint = function(x, y) {
                const point = map.latLngToLayerPoint(new L.LatLng(y, x))
                this.stream.point(point.x, point.y)
            };
        let projection = d3.geoTransform({point: projectPoint});
        let geoGenerator = d3.geoPath().projection(projection);
        
        const overlay = d3.select(map.getPanes().overlayPane);
    
        const svg = overlay.select('svg').attr("pointer-events", "auto"),
                g = svg.append('g').attr('class', 'leaflet-zoom-hide');
        mcppCountsSorted = await getMapData(picker.getStartDate(), picker.getEndDate());
        const legend = document.querySelector('.legend');
        legend.innerHTML = '';
        legend.append(Legend(d3.scaleSqrt([mcppCountsSorted[mcppCountsSorted.length - 1].count, mcppCountsSorted[0].count], ["#ADD8E6","#8B0000"]), {
                title: "Crimes (Count)"
        }));

        let myColor = d3.scaleLinear()
            .domain([mcppCountsSorted[mcppCountsSorted.length - 1].count, mcppCountsSorted[0].count])
            .range(["#ADD8E6","#8B0000"]);

        // Create the MCPP path regions
        const path = g.selectAll('path')
            .data(json.features)
            .enter()
            .append('path')
            .attr('d', geoGenerator)
            .attr('fill-opacity', 0.5)
            .attr('fill', (d) => myColor(mcppCounts[d.properties.NAME]))
            .attr('stroke', '#fff')
            .attr('stroke-width', .3)
            .on("mouseover", function(e, d) {
                d3.select(this).attr("fill-opacity", 0.2)
                currentHighlighted.textContent = d.properties.NAME;
                currentCount.textContent = `(${mcppCounts[d.properties.NAME]} Total Incidents)`;
            })
            .on("mouseout", function(d) {
                d3.select(this).attr("fill-opacity", 0.5)
            })
            .on("click", async function(e, d) {
                const startTime = picker.getStartDate().dateInstance.toISOString().slice(0,10);
                const endTime = picker.getEndDate().dateInstance.toISOString().slice(0,10);
                // add MCPP onclick events here, d3.select(this).attr() changes the style of the selected element
                const response = await fetch(`https://data.seattle.gov/resource/tazs-3rd5.json?mcpp=${d.properties.NAME}&$where=offense_start_datetime%20%3E=%20%27${startTime}T00:00:00%27%20and%20offense_start_datetime%3C=%27${endTime}T00:00:00%27&$limit=${10000}`);
                const data = await response.json();
                let mcppOffCounts = {};
                data.forEach(d => {mcppOffCounts[d.offense] ? (mcppOffCounts[d.offense] += 1):(mcppOffCounts[d.offense] = 1)});
                document.querySelector('.crime-value').textContent = mcppOffCounts[document.getElementById('crimes').value];
            });

            const onZoom = () => {path.attr('d', geoGenerator)};
            onZoom();
            map.on('zoomend', onZoom);
    };

    renderMap();
});

// Copyright 2021, Observable Inc.
// Released under the ISC license.
// https://observablehq.com/@d3/color-legend
function Legend(color, {
    title,
    tickSize = 6,
    width = 320, 
    height = 44 + tickSize,
    marginTop = 18,
    marginRight = 0,
    marginBottom = 16 + tickSize,
    marginLeft = 0,
    ticks = width / 64,
    tickFormat,
    tickValues
    } = {}) {

    function ramp(color, n = 256) {
        const canvas = document.createElement("canvas");
        canvas.width = n;
        canvas.height = 1;
        const context = canvas.getContext("2d");
        for (let i = 0; i < n; ++i) {
        context.fillStyle = color(i / (n - 1));
        context.fillRect(i, 0, 1, 1);
        }
        return canvas;
    }

    const svg = d3.create("svg")
        .attr("width", width)
        .attr("height", height)
        .attr("viewBox", [0, 0, width, height])
        .style("overflow", "visible")
        .style("display", "block");

    let tickAdjust = g => g.selectAll(".tick line").attr("y1", marginTop + marginBottom - height);
    let x;

    // Continuous
    if (color.interpolate) {
        const n = Math.min(color.domain().length, color.range().length);

        x = color.copy().rangeRound(d3.quantize(d3.interpolate(marginLeft, width - marginRight), n));

        svg.append("image")
            .attr("x", marginLeft)
            .attr("y", marginTop)
            .attr("width", width - marginLeft - marginRight)
            .attr("height", height - marginTop - marginBottom)
            .attr("preserveAspectRatio", "none")
            .attr("xlink:href", ramp(color.copy().domain(d3.quantize(d3.interpolate(0, 1), n))).toDataURL());
    }

    // Sequential
    else if (color.interpolator) {
        x = Object.assign(color.copy()
            .interpolator(d3.interpolateRound(marginLeft, width - marginRight)),
            {range() { return [marginLeft, width - marginRight]; }});

        svg.append("image")
            .attr("x", marginLeft)
            .attr("y", marginTop)
            .attr("width", width - marginLeft - marginRight)
            .attr("height", height - marginTop - marginBottom)
            .attr("preserveAspectRatio", "none")
            .attr("xlink:href", ramp(color.interpolator()).toDataURL());

        // scaleSequentialQuantile doesn’t implement ticks or tickFormat.
        if (!x.ticks) {
        if (tickValues === undefined) {
            const n = Math.round(ticks + 1);
            tickValues = d3.range(n).map(i => d3.quantile(color.domain(), i / (n - 1)));
        }
        if (typeof tickFormat !== "function") {
            tickFormat = d3.format(tickFormat === undefined ? ",f" : tickFormat);
        }
        }
    }

    // Threshold
    else if (color.invertExtent) {
        const thresholds
            = color.thresholds ? color.thresholds() // scaleQuantize
            : color.quantiles ? color.quantiles() // scaleQuantile
            : color.domain(); // scaleThreshold

        const thresholdFormat
            = tickFormat === undefined ? d => d
            : typeof tickFormat === "string" ? d3.format(tickFormat)
            : tickFormat;

        x = d3.scaleLinear()
            .domain([-1, color.range().length - 1])
            .rangeRound([marginLeft, width - marginRight]);

        svg.append("g")
        .selectAll("rect")
        .data(color.range())
        .join("rect")
            .attr("x", (d, i) => x(i - 1))
            .attr("y", marginTop)
            .attr("width", (d, i) => x(i) - x(i - 1))
            .attr("height", height - marginTop - marginBottom)
            .attr("fill", d => d);

        tickValues = d3.range(thresholds.length);
        tickFormat = i => thresholdFormat(thresholds[i], i);
    }

    // Ordinal
    else {
        x = d3.scaleBand()
            .domain(color.domain())
            .rangeRound([marginLeft, width - marginRight]);

        svg.append("g")
        .selectAll("rect")
        .data(color.domain())
        .join("rect")
            .attr("x", x)
            .attr("y", marginTop)
            .attr("width", Math.max(0, x.bandwidth() - 1))
            .attr("height", height - marginTop - marginBottom)
            .attr("fill", color);

        tickAdjust = () => {};
    }

    svg.append("g")
        .attr("transform", `translate(0,${height - marginBottom})`)
        .call(d3.axisBottom(x)
            .ticks(ticks, typeof tickFormat === "string" ? tickFormat : undefined)
            .tickFormat(typeof tickFormat === "function" ? tickFormat : undefined)
            .tickSize(tickSize)
            .tickValues(tickValues))
        .call(tickAdjust)
        .call(g => g.select(".domain").remove())
        .call(g => g.append("text")
            .attr("x", marginLeft)
            .attr("y", marginTop + marginBottom - height - 6)
            .attr("fill", "currentColor")
            .attr("text-anchor", "start")
            .attr("font-weight", "bold")
            .attr("class", "title")
            .text(title));

    return svg.node();
}