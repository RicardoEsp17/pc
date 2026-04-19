var map = L.map('map').setView([40.4167, -3.7033], 6);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

var markersLayer = L.layerGroup().addTo(map);
var datosCompletos = [];
var tipoSeleccionado = '';

// El valor base ahora se calcula dinámicamente en la función
const ZOOM_PC = 11; // Escala ~20km
const ZOOM_MOVIL = 11;

const LOGOS_MARCAS = {
    'REPSOL': 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e8/Repsol_logo.svg/512px-Repsol_logo.svg.png',
    'CEPSA': 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/81/Marca_Cepsa_Vertical.jpg/441px-Marca_Cepsa_Vertical.jpg',
    'BP': 'https://upload.wikimedia.org/wikipedia/en/thumb/d/d2/BP_Helios_logo.svg/800px-BP_Helios_logo.svg.png',
    'SHELL': 'https://upload.wikimedia.org/wikipedia/en/thumb/e/e8/Shell_logo.svg/800px-Shell_logo.svg.png',
    'GALP': 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/02/Galp_Energia_logo.svg/1024px-Galp_Energia_logo.svg.png',
    'PETRONOR': 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3d/Petronor_logo.svg/800px-Petronor_logo.svg.png',
    'PLENOIL': 'https://upload.wikimedia.org/wikipedia/commons/7/77/Logo_Plenoil.png',
    'AVIA': 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f6/AVIA_logo.svg/1280px-AVIA_logo.svg.png',
    'BALLENOIL': 'https://upload.wikimedia.org/wikipedia/commons/8/8e/Logo_ballenoil.png',
    'DEFAULT': 'https://cdn-icons-png.flaticon.com/512/9922/9922079.png'
};

window.onload = function() {
    cargarDatosIniciales();
    setTimeout(() => { map.invalidateSize(); }, 500);
    
    // Recalcular tamaño si se gira el móvil o se redimensiona el navegador
    window.addEventListener('resize', () => {
        map.invalidateSize();
        actualizarMapaYLista(); // Re-comprobar zoom según nuevo ancho
    });

    document.getElementById('input-localidad').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            buscarLocalidad();
        }
    });
};

async function cargarDatosIniciales() {
    try {
        const response = await fetch('https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/EstacionesTerrestres/');
        const data = await response.json();
        datosCompletos = data.ListaEESSPrecio.filter(e => e['Tipo Venta'] === 'P');
        calcularYMostrarMedias(datosCompletos);
        selectFuel(document.querySelector('.btn-gas95'), 'gas95');
    } catch (e) { console.error("Error API", e); }
}

function selectFuel(btn, id) {
    if(!btn) return;
    document.querySelectorAll('.fuel-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    tipoSeleccionado = id;
    actualizarMapaYLista();
}

function obtenerLogoUrl(rotulo) {
    if (!rotulo) return LOGOS_MARCAS['DEFAULT'];
    const r = rotulo.toUpperCase();
    if (r.includes('REPSOL')) return LOGOS_MARCAS['REPSOL'];
    if (r.includes('CEPSA')) return LOGOS_MARCAS['CEPSA'];
    if (r.includes('BP')) return LOGOS_MARCAS['BP'];
    if (r.includes('SHELL')) return LOGOS_MARCAS['SHELL'];
    if (r.includes('GALP')) return LOGOS_MARCAS['GALP'];
    if (r.includes('PETRONOR')) return LOGOS_MARCAS['PETRONOR'];
    if (r.includes('AVIA')) return LOGOS_MARCAS['AVIA'];
    if (r.includes('PLENOIL')) return LOGOS_MARCAS['PLENOIL'];
    if (r.includes('BALLENOIL')) return LOGOS_MARCAS['BALLENOIL'];
    return LOGOS_MARCAS['DEFAULT'];
}

function actualizarMapaYLista() {
    markersLayer.clearLayers();
    const sidebar = document.getElementById('sidebar-lista');
    if (!datosCompletos || !tipoSeleccionado || !sidebar) return;
    
    sidebar.innerHTML = "";
    
    // Lógica diferenciada por dispositivo
    const esMovil = window.innerWidth <= 768;
    const zoomMinimoRequerido = esMovil ? ZOOM_MOVIL : ZOOM_PC;

    if (map.getZoom() < zoomMinimoRequerido) {
        sidebar.innerHTML = `<p style="text-align:center; padding:20px; color:black;">Acércate al mapa para ver precios.</p>`;
        return;
    }

    const bounds = map.getBounds();

    let visibles = datosCompletos.filter(e => {
        const p = obtenerPrecio(e, tipoSeleccionado);
        if (!p) return false;
        const lat = parseFloat(e.Latitud.replace(',', '.'));
        const lon = parseFloat(e['Longitud (WGS84)'].replace(',', '.'));
        return bounds.contains([lat, lon]);
    });

    visibles.sort((a, b) => obtenerPrecio(a, tipoSeleccionado) - obtenerPrecio(b, tipoSeleccionado));

    const precios = visibles.map(e => obtenerPrecio(e, tipoSeleccionado));
    const min = Math.min(...precios), max = Math.max(...precios), rango = (max - min) / 3;

    visibles.forEach(e => {
        const p = obtenerPrecio(e, tipoSeleccionado);
        const lat = parseFloat(e.Latitud.replace(',', '.')), lon = parseFloat(e['Longitud (WGS84)'].replace(',', '.'));
        let col = p < min + rango ? 'price-low' : (p < min + rango * 2 ? 'price-medium' : 'price-high');

        const item = document.createElement('div');
        item.className = 'gas-item';
        item.innerHTML = `<div>
                    <span class="gas-name">${e['Rótulo']}</span>
                    <span class="gas-address">${e.Dirección} (${e.Localidad})</span>
                  </div>
                  <div class="gas-price ${col}">${p.toFixed(3)}€/L</div>`;
        item.onclick = () => map.setView([lat, lon], 16);
        sidebar.appendChild(item);

        const logoUrl = obtenerLogoUrl(e['Rótulo']);
        const customIcon = L.divIcon({
        className: 'custom-gas-marker',
        html: `<div class="marker-content">
              <div class="marker-price ${col}">${p.toFixed(3)}€/L</div>
             </div>`,
        iconSize: [70, 28],
        iconAnchor: [35, 14]   // centro del recuadro = posición exacta
        });

        L.marker([lat, lon], { icon: customIcon }).addTo(markersLayer);
    });
}

function normalizarTexto(texto) {
    if (!texto) return "";
    return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function buscarLocalidad() {
    const inputVal = document.getElementById('input-localidad').value.trim();
    if (!inputVal) return;
    const busquedaNormalizada = normalizarTexto(inputVal);
    const m = datosCompletos.find(e => {
        const municipio = normalizarTexto(e.Municipio);
        const localidad = normalizarTexto(e.Localidad);
        return municipio.includes(busquedaNormalizada) || localidad.includes(busquedaNormalizada);
    });

    if (m) {
        const lat = parseFloat(m.Latitud.replace(',', '.'));
        const lon = parseFloat(m['Longitud (WGS84)'].replace(',', '.'));
        map.setView([lat, lon], 13);
        document.getElementById('input-localidad').blur(); 
    } else {
        alert("No se ha encontrado la localidad: " + inputVal);
    }
}

function obtenerPrecio(e, t) {
    const k = t==='gas95'?'Precio Gasolina 95 E5':(t==='dizel'?'Precio Gasoleo A':'Precio Gasoleo Premium');
    return e[k] ? parseFloat(e[k].replace(',', '.')) : null;
}

function calcularYMostrarMedias(estaciones) {
    const tipos = {'gas95': 'Precio Gasolina 95 E5', 'dizel': 'Precio Gasoleo A', 'dizel_plus': 'Precio Gasoleo Premium'};
    const ids = {'gas95': 'avg-gas95', 'dizel': 'avg-dizel', 'dizel_plus': 'avg-dizel-plus'};
    const IEH = {'gas95': 0.472, 'dizel': 0.379, 'dizel_plus': 0.379};

    Object.keys(tipos).forEach(t => {
        let ps = estaciones.map(e => e[tipos[t]]).filter(p => p).map(p => parseFloat(p.replace(',', '.')));
        if (ps.length) {
            const mediaTotal = ps.reduce((a,b)=>a+b,0)/ps.length;
            document.getElementById(ids[t]).innerText = mediaTotal.toFixed(3) + " €/L";
            const iva = mediaTotal - (mediaTotal / 1.21);
            const hidrocarburos = IEH[t];
            const materiaBeneficio = mediaTotal - iva - hidrocarburos;
            const container = document.getElementById(`breakdown-${t}`);
            const vals = container.querySelectorAll('.val');
            vals[0].innerText = materiaBeneficio.toFixed(3) + "€/L";
            vals[1].innerText = hidrocarburos.toFixed(3) + "€/L";
            vals[2].innerText = iva.toFixed(3) + "€/L";
        }
    });
}

map.on('moveend', actualizarMapaYLista);
