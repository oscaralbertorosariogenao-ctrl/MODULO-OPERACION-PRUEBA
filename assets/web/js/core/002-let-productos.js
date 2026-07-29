

let productos = [
  {
    nombre:"Printer",
    marca:"Sewoo",
    modelo:"T-V1",
    precio:"2,850",
    categoria:"Equipos",
    imagen:"https://cdn-icons-png.flaticon.com/512/1041/1041880.png"
  },
  {
    nombre:"Telefono",
    marca:"Grandstream",
    modelo:"2601P",
    precio:"1,850",
    categoria:"Equipos",
    imagen:"https://cdn-icons-png.flaticon.com/512/15/15874.png"
  },
  {
    nombre:"Maquina de venta",
    marca:"Scope AIO CI5 - Loteka",
    modelo:"1era Generación Doble Pantalla (4GB Ram/64GB SSD)",
    precio:"21,600",
    categoria:"Equipos",
    imagen:"https://cdn-icons-png.flaticon.com/512/3135/3135715.png"
  }
];

let almacenes = [
  {
    nombre:"Almacén Principal",
    ubicacion:"Edificio Sur (1er piso)",
    descripcion:"Almacén físico",
    stats:{productos:0, unidades:"0", ultimo:"Sin movimientos"},
    inventario:[],
    movimientos:[]
  },
  {
    nombre:"Almacén Santiago",
    ubicacion:"Zona Norte",
    descripcion:"Sucursal",
    stats:{productos:0, unidades:"0", ultimo:"Sin movimientos"},
    inventario:[],
    movimientos:[]
  },
  {
    nombre:"Almacén Norte",
    ubicacion:"Santo Domingo Norte",
    descripcion:"Regional",
    stats:{productos:0, unidades:"0", ultimo:"Sin movimientos"},
    inventario:[],
    movimientos:[]
  }
];


const categoriasAgencia = ['equipos','camara','routers','electricos','adicional'];
let agenciaDetalleActualIndex = null;
let agenciaTabActual = 'equipos';

const equiposBaseAgencia = [
  {categoria:'equipos', producto:'Monitor', imagen:'https://cdn-icons-png.flaticon.com/512/3474/3474360.png', marca:'KTC', modelo:'32\" Azul Loteka', serial:'M32LED-252HQ-001', fechaInstalacion:'02/02/2026'},
  {categoria:'equipos', producto:'Maquina de Venta', imagen:'https://cdn-icons-png.flaticon.com/512/3135/3135715.png', marca:'Scope N119B - Loteka', modelo:'3era Generación (8GB Ram/64GB SSD)', serial:'N139A2025031', fechaInstalacion:'02/08/2025'},
  {categoria:'camara', producto:'Camara de seguridad', imagen:'https://cdn-icons-png.flaticon.com/512/685/685655.png', marca:'Hik Vision', modelo:'Turret 4MP DS-2CV1F43G2', serial:'HK-4MP-1001', fechaInstalacion:'15/01/2026'},
  {categoria:'routers', producto:'Router', imagen:'https://cdn-icons-png.flaticon.com/512/1041/1041372.png', marca:'TP-Link', modelo:'Archer C80', serial:'RT-AX-2001', fechaInstalacion:'17/03/2026'},
  {categoria:'electricos', producto:'UPS', imagen:'https://cdn-icons-png.flaticon.com/512/3063/3063821.png', marca:'CDP', modelo:'R-Smart 1010', serial:'UPS-45002', fechaInstalacion:'10/04/2026'},
  {categoria:'adicional', producto:'Scanner', imagen:'https://cdn-icons-png.flaticon.com/512/2920/2920339.png', marca:'Witek', modelo:'MIS200 OMR A6', serial:'SC-772001', fechaInstalacion:'21/04/2026'}
];

const AGENCY_GEO_CATALOG = {
  435: { lat: 18.5383784, lng: -69.9395547, encargado: 'encargado1', grupo: 'Grupo 44', direccion: 'Agencia 0435, G-44' },
  1000: { lat: 18.539837, lng: -69.935708, encargado: 'encargado1', grupo: 'Grupo 44', direccion: 'Agencia 1000, G-44' },
  1002: { lat: 18.537551854, lng: -69.93503565, encargado: 'encargado1', grupo: 'Grupo 44', direccion: 'Agencia 1002, G-44' },
  1005: { lat: 18.5299566, lng: -69.9447317, encargado: 'encargado1', grupo: 'Grupo 44', direccion: 'Agencia 1005, G-44' },
  1006: { lat: 18.53366, lng: -69.94227, encargado: 'encargado1', grupo: 'Grupo 44', direccion: 'Agencia 1006, G-44' },
  1009: { lat: 18.52999, lng: -69.94656, encargado: 'encargado1', grupo: 'Grupo 44', direccion: 'Agencia 1009, G-44' },
  1012: { lat: 18.53146, lng: -69.94703, encargado: 'encargado1', grupo: 'Grupo 44', direccion: 'Agencia 1012, G-44' },
  1014: { lat: 18.534781, lng: -69.937492, encargado: 'encargado1', grupo: 'Grupo 44', direccion: 'Agencia 1014, G-44' },
  1016: { lat: 18.534701, lng: -69.936428, encargado: 'encargado1', grupo: 'Grupo 44', direccion: 'Agencia 1016, G-44' },
  1078: { lat: 18.54044, lng: -69.93808, encargado: 'encargado1', grupo: 'Grupo 44', direccion: 'Agencia 1078, G-44' },
  1079: { lat: 18.5327, lng: -69.93778, encargado: 'encargado1', grupo: 'Grupo 44', direccion: 'Agencia 1079, G-44' },
  1081: { lat: 18.538744, lng: -69.934412, encargado: 'encargado1', grupo: 'Grupo 44', direccion: 'Agencia 1081, G-44' },
  1082: { lat: 18.54013, lng: -69.9388, encargado: 'encargado1', grupo: 'Grupo 44', direccion: 'Agencia 1082, G-44' },
  1083: { lat: 18.53792994, lng: -69.9345332, encargado: 'encargado1', grupo: 'Grupo 44', direccion: 'Agencia 1083, G-44' },
  1084: { lat: 18.5332, lng: -69.93671, encargado: 'encargado1', grupo: 'Grupo 44', direccion: 'Agencia 1084, G-44' },
  1085: { lat: 18.5367476, lng: -69.9318985, encargado: 'encargado1', grupo: 'Grupo 44', direccion: 'Agencia 1085, G-44' },
  1086: { lat: 18.533562, lng: -69.928482, encargado: 'encargado1', grupo: 'Grupo 44', direccion: 'Agencia 1086, G-44' },
  1088: { lat: 18.53926, lng: -69.93532, encargado: 'encargado1', grupo: 'Grupo 44', direccion: 'Agencia 1088, G-44' },
  1099: { lat: 18.5386, lng: -69.93836, encargado: 'encargado1', grupo: 'Grupo 44', direccion: 'Agencia 1099, G-44' },
  1107: { lat: 18.53655, lng: -69.94318, encargado: 'encargado1', grupo: 'Grupo 44', direccion: 'Agencia 1107, G-44' },
  1111: { lat: 18.54126, lng: -69.93838, encargado: 'encargado1', grupo: 'Grupo 44', direccion: 'Agencia 1111, G-44' },
  1112: { lat: 18.5417, lng: -69.94032, encargado: 'encargado1', grupo: 'Grupo 44', direccion: 'Agencia 1112, G-44' },
  1123: { lat: 18.54313, lng: -69.93831, encargado: 'encargado1', grupo: 'Grupo 44', direccion: 'Agencia 1123, G-44' },
  1130: { lat: 18.54045, lng: -69.93627, encargado: 'encargado1', grupo: 'Grupo 44', direccion: 'Agencia 1130, G-44' },
  1133: { lat: 18.53939, lng: -69.93793, encargado: 'encargado1', grupo: 'Grupo 44', direccion: 'Agencia 1133, G-44' },
  1134: { lat: 18.53912, lng: -69.93677, encargado: 'encargado1', grupo: 'Grupo 44', direccion: 'Agencia 1134, G-44' },
  1137: { lat: 18.54093, lng: -69.93948, encargado: 'encargado1', grupo: 'Grupo 44', direccion: 'Agencia 1137, G-44' },
  1139: { lat: 18.54098, lng: -69.93827, encargado: 'encargado1', grupo: 'Grupo 44', direccion: 'Agencia 1139, G-44' },
  1152: { lat: 18.53875, lng: -69.93989, encargado: 'encargado1', grupo: 'Grupo 44', direccion: 'Agencia 1152, G-44' },
  1166: { lat: 18.53615, lng: -69.93937, encargado: 'encargado1', grupo: 'Grupo 44', direccion: 'Agencia 1166, G-44' },
  1170: { lat: 18.5364788, lng: -69.9319777, encargado: 'encargado1', grupo: 'Grupo 44', direccion: 'Agencia 1170, G-44' },
  1183: { lat: 18.53836, lng: -69.94222, encargado: 'encargado1', grupo: 'Grupo 44', direccion: 'Agencia 1183, G-44' },
  1184: { lat: 18.53829, lng: -69.94306, encargado: 'encargado1', grupo: 'Grupo 44', direccion: 'Agencia 1184, G-44' },
  1185: { lat: 18.54187, lng: -69.93909, encargado: 'encargado1', grupo: 'Grupo 44', direccion: 'Agencia 1185, G-44' },
  1186: { lat: 18.54281, lng: -69.93962, encargado: 'encargado1', grupo: 'Grupo 44', direccion: 'Agencia 1186, G-44' },
  1187: { lat: 18.53729, lng: -69.93586, encargado: 'encargado1', grupo: 'Grupo 44', direccion: 'Agencia 1187, G-44' },
  1188: { lat: 18.53521, lng: -69.93818, encargado: 'encargado1', grupo: 'Grupo 44', direccion: 'Agencia 1188, G-44' },
  1189: { lat: 18.53295, lng: -69.94509, encargado: 'encargado1', grupo: 'Grupo 44', direccion: 'Agencia 1189, G-44' },
  147: { lat: 18.5466634, lng: -69.9162626, encargado: 'Jose Pacheco', grupo: 'Grupo 45', direccion: 'Agencia 0147, G-45' },
  449: { lat: 18.544266, lng: -69.941925, encargado: 'Jose Pacheco', grupo: 'Grupo 45', direccion: 'Agencia 0449, G-45' },
  468: { lat: 18.5451777, lng: -69.9433883, encargado: 'Jose Pacheco', grupo: 'Grupo 45', direccion: 'Agencia 0468, G-45' },
  469: { lat: 18.545726, lng: -69.941777, encargado: 'Jose Pacheco', grupo: 'Grupo 45', direccion: 'Agencia 0469, G-45' },
  1001: { lat: 18.550821, lng: -69.943429, encargado: 'Jose Pacheco', grupo: 'Grupo 45', direccion: 'Agencia 1001, G-45' },
  1003: { lat: 18.539312, lng: -69.926788, encargado: 'Jose Pacheco', grupo: 'Grupo 45', direccion: 'Agencia 1003, G-45' },
  1013: { lat: 18.54265, lng: -69.94234, encargado: 'Jose Pacheco', grupo: 'Grupo 45', direccion: 'Agencia 1013, G-45' },
  1015: { lat: 18.54585, lng: -69.91448, encargado: 'Jose Pacheco', grupo: 'Grupo 45', direccion: 'Agencia 1015, G-45' },
  1017: { lat: 18.546961, lng: -69.923225, encargado: 'Jose Pacheco', grupo: 'Grupo 45', direccion: 'Agencia 1017, G-45' },
  1039: { lat: 18.540206, lng: -69.929702, encargado: 'Jose Pacheco', grupo: 'Grupo 45', direccion: 'Agencia 1039, G-45' },
  1074: { lat: 18.53377393, lng: -69.95208045, encargado: 'Jose Pacheco', grupo: 'Grupo 45', direccion: 'Agencia 1074, G-45' },
  1075: { lat: 18.545063, lng: -69.9259659, encargado: 'Jose Pacheco', grupo: 'Grupo 45', direccion: 'Agencia 1075, G-45' },
  1076: { lat: 18.5396652, lng: -69.9296783, encargado: 'Jose Pacheco', grupo: 'Grupo 45', direccion: 'Agencia 1076, G-45' },
  1080: { lat: 18.54498, lng: -69.93094, encargado: 'Jose Pacheco', grupo: 'Grupo 45', direccion: 'Agencia 1080, G-45' },
  1091: { lat: 18.54164, lng: -69.92511, encargado: 'Jose Pacheco', grupo: 'Grupo 45', direccion: 'Agencia 1091, G-45' },
  1108: { lat: 18.54487, lng: -69.92773, encargado: 'Jose Pacheco', grupo: 'Grupo 45', direccion: 'Agencia 1108, G-45' },
  1113: { lat: 18.54242, lng: -69.93478, encargado: 'Jose Pacheco', grupo: 'Grupo 45', direccion: 'Agencia 1113, G-45' },
  1135: { lat: 18.54086, lng: -69.93275, encargado: 'Jose Pacheco', grupo: 'Grupo 45', direccion: 'Agencia 1135, G-45' },
  1136: { lat: 18.53955, lng: -69.92908, encargado: 'Jose Pacheco', grupo: 'Grupo 45', direccion: 'Agencia 1136, G-45' },
  1138: { lat: 18.54519, lng: -69.94224, encargado: 'Jose Pacheco', grupo: 'Grupo 45', direccion: 'Agencia 1138, G-45' },
  1144: { lat: 18.54107, lng: -69.92434, encargado: 'Jose Pacheco', grupo: 'Grupo 45', direccion: 'Agencia 1144, G-45' },
  1145: { lat: 18.537783368, lng: -69.92610096, encargado: 'Jose Pacheco', grupo: 'Grupo 45', direccion: 'Agencia 1145, G-45' },
  1146: { lat: 18.54107, lng: -69.92607, encargado: 'Jose Pacheco', grupo: 'Grupo 45', direccion: 'Agencia 1146, G-45' },
  1147: { lat: 18.56015, lng: -69.95136, encargado: 'Jose Pacheco', grupo: 'Grupo 45', direccion: 'Agencia 1147, G-45' },
  1148: { lat: 18.55851, lng: -69.95348, encargado: 'Jose Pacheco', grupo: 'Grupo 45', direccion: 'Agencia 1148, G-45' },
  1149: { lat: 18.55747, lng: -69.95574, encargado: 'Jose Pacheco', grupo: 'Grupo 45', direccion: 'Agencia 1149, G-45' },
  1150: { lat: 18.54046, lng: -69.93102, encargado: 'Jose Pacheco', grupo: 'Grupo 45', direccion: 'Agencia 1150, G-45' },
  1169: { lat: 18.54397, lng: -69.92476, encargado: 'Jose Pacheco', grupo: 'Grupo 45', direccion: 'Agencia 1169, G-45' },
  1173: { lat: 18.5654099, lng: -69.938017, encargado: 'Jose Pacheco', grupo: 'Grupo 45', direccion: 'Agencia 1173, G-45' },
  1178: { lat: 18.54473, lng: -69.94296, encargado: 'Jose Pacheco', grupo: 'Grupo 45', direccion: 'Agencia 1178, G-45' },
  1179: { lat: 18.54319, lng: -69.93537, encargado: 'Jose Pacheco', grupo: 'Grupo 45', direccion: 'Agencia 1179, G-45' },
  1180: { lat: 18.54133, lng: -69.93489, encargado: 'Jose Pacheco', grupo: 'Grupo 45', direccion: 'Agencia 1180, G-45' },
  1181: { lat: 18.54135, lng: -69.93523, encargado: 'Jose Pacheco', grupo: 'Grupo 45', direccion: 'Agencia 1181, G-45' },
  1182: { lat: 18.542, lng: -69.93636, encargado: 'Jose Pacheco', grupo: 'Grupo 45', direccion: 'Agencia 1182, G-45' },
  1194: { lat: 18.5433, lng: -69.93117, encargado: 'Jose Pacheco', grupo: 'Grupo 45', direccion: 'Agencia 1194, G-45' },
  1195: { lat: 18.5446, lng: -69.92995, encargado: 'Jose Pacheco', grupo: 'Grupo 45', direccion: 'Agencia 1195, G-45' },
  1196: { lat: 18.53999, lng: -69.92535, encargado: 'Jose Pacheco', grupo: 'Grupo 45', direccion: 'Agencia 1196, G-45' },
  1197: { lat: 18.54375, lng: -69.9366, encargado: 'Jose Pacheco', grupo: 'Grupo 45', direccion: 'Agencia 1197, G-45' },
  1198: { lat: 18.54525, lng: -69.93396, encargado: 'Jose Pacheco', grupo: 'Grupo 45', direccion: 'Agencia 1198, G-45' },
  1199: { lat: 18.5438, lng: -69.94279, encargado: 'Jose Pacheco', grupo: 'Grupo 45', direccion: 'Agencia 1199, G-45' },
  1200: { lat: 18.55084, lng: -69.92424, encargado: 'Jose Pacheco', grupo: 'Grupo 45', direccion: 'Agencia 1200, G-45' },
  1201: { lat: 18.54338, lng: -69.92398, encargado: 'Jose Pacheco', grupo: 'Grupo 45', direccion: 'Agencia 1201, G-45' },
  1211: { lat: 18.53787, lng: -69.93086, encargado: 'Jose Pacheco', grupo: 'Grupo 45', direccion: 'Agencia 1211, G-45' },
  1212: { lat: 18.54523028, lng: -69.9335384, encargado: 'Jose Pacheco', grupo: 'Grupo 45', direccion: 'Agencia 1212, G-45' },
  20: { lat: 18.532108, lng: -69.907968, encargado: 'Jose Antonio', grupo: 'Grupo 42', direccion: 'Agencia 0020, G-42' },
  40: { lat: 18.518021, lng: -69.906286, encargado: 'Jose Antonio', grupo: 'Grupo 42', direccion: 'Agencia 0040, G-42' },
  78: { lat: 18.5249762, lng: -69.9085271, encargado: 'Jose Antonio', grupo: 'Grupo 42', direccion: 'Agencia 0078, G-42' },
  164: { lat: 18.526316, lng: -69.915635, encargado: 'Jose Antonio', grupo: 'Grupo 42', direccion: 'Agencia 0164, G-42' },
  171: { lat: 18.5255662, lng: -69.9199212, encargado: 'Jose Antonio', grupo: 'Grupo 42', direccion: 'Agencia 0171, G-42' },
  172: { lat: 18.5262274, lng: -69.9202752, encargado: 'Jose Antonio', grupo: 'Grupo 42', direccion: 'Agencia 0172, G-42' },
  173: { lat: 18.526736, lng: -69.9140418, encargado: 'Jose Antonio', grupo: 'Grupo 42', direccion: 'Agencia 0173, G-42' },
  383: { lat: 18.52029562, lng: -69.9135794, encargado: 'Jose Antonio', grupo: 'Grupo 42', direccion: 'Agencia 0383, G-42' },
  384: { lat: 18.517458, lng: -69.908417, encargado: 'Jose Antonio', grupo: 'Grupo 42', direccion: 'Agencia 0384, G-42' },
  385: { lat: 18.530474, lng: -69.923444, encargado: 'Jose Antonio', grupo: 'Grupo 42', direccion: 'Agencia 0385, G-42' },
  386: { lat: 18.529236, lng: -69.92498, encargado: 'Jose Antonio', grupo: 'Grupo 42', direccion: 'Agencia 0386, G-42' },
  387: { lat: 18.536936, lng: -69.911942, encargado: 'Jose Antonio', grupo: 'Grupo 42', direccion: 'Agencia 0387, G-42' },
  388: { lat: 18.523741, lng: -69.91716, encargado: 'Jose Antonio', grupo: 'Grupo 42', direccion: 'Agencia 0388, G-42' },
  389: { lat: 18.529902, lng: -69.908325, encargado: 'Jose Antonio', grupo: 'Grupo 42', direccion: 'Agencia 0389, G-42' },
  390: { lat: 18.535532, lng: -69.907173, encargado: 'Jose Antonio', grupo: 'Grupo 42', direccion: 'Agencia 0390, G-42' },
  392: { lat: 18.530077, lng: -69.915367, encargado: 'Jose Antonio', grupo: 'Grupo 42', direccion: 'Agencia 0392, G-42' },
  433: { lat: 18.5284952, lng: -69.9035706, encargado: 'Jose Antonio', grupo: 'Grupo 42', direccion: 'Agencia 0433, G-42' },
  434: { lat: 18.5252447, lng: -69.9005304, encargado: 'Jose Antonio', grupo: 'Grupo 42', direccion: 'Agencia 0434, G-42' },
  436: { lat: 18.513687, lng: -69.903561, encargado: 'Jose Antonio', grupo: 'Grupo 42', direccion: 'Agencia 0436, G-42' },
  437: { lat: 18.514272, lng: -69.904444, encargado: 'Jose Antonio', grupo: 'Grupo 42', direccion: 'Agencia 0437, G-42' },
  438: { lat: 18.516355, lng: -69.902679, encargado: 'Jose Antonio', grupo: 'Grupo 42', direccion: 'Agencia 0438, G-42' },
  441: { lat: 18.521466, lng: -69.90848, encargado: 'Jose Antonio', grupo: 'Grupo 42', direccion: 'Agencia 0441, G-42' },
  442: { lat: 18.5270682, lng: -69.9111357, encargado: 'Jose Antonio', grupo: 'Grupo 42', direccion: 'Agencia 0442, G-42' },
  443: { lat: 18.527583, lng: -69.905996, encargado: 'Jose Antonio', grupo: 'Grupo 42', direccion: 'Agencia 0443, G-42' },
  444: { lat: 18.525484, lng: -69.906829, encargado: 'Jose Antonio', grupo: 'Grupo 42', direccion: 'Agencia 0444, G-42' },
  1004: { lat: 18.523136, lng: -69.914986, encargado: 'Jose Antonio', grupo: 'Grupo 42', direccion: 'Agencia 1004, G-42' },
  1007: { lat: 18.531179, lng: -69.90744, encargado: 'Jose Antonio', grupo: 'Grupo 42', direccion: 'Agencia 1007, G-42' },
  1008: { lat: 18.5273091, lng: -69.9136024, encargado: 'Jose Antonio', grupo: 'Grupo 42', direccion: 'Agencia 1008, G-42' },
  1010: { lat: 18.5227706, lng: -69.9173386, encargado: 'Jose Antonio', grupo: 'Grupo 42', direccion: 'Agencia 1010, G-42' },
  1011: { lat: 18.527056, lng: -69.915314, encargado: 'Jose Antonio', grupo: 'Grupo 42', direccion: 'Agencia 1011, G-42' },
  1019: { lat: 18.525534, lng: -69.9124047, encargado: 'Jose Antonio', grupo: 'Grupo 42', direccion: 'Agencia 1019, G-42' },
  1020: { lat: 18.541748, lng: -69.896881, encargado: 'Jose Antonio', grupo: 'Grupo 42', direccion: 'Agencia 1020, G-42' },
  1036: { lat: 18.534449768, lng: -69.89467668, encargado: 'Jose Antonio', grupo: 'Grupo 42', direccion: 'Agencia 1036, G-42' },
  1037: { lat: 18.526878947, lng: -69.92086343, encargado: 'Jose Antonio', grupo: 'Grupo 42', direccion: 'Agencia 1037, G-42' },
  1103: { lat: 18.52608, lng: -69.91711, encargado: 'Jose Antonio', grupo: 'Grupo 42', direccion: 'Agencia 1103, G-42' },
  1104: { lat: 18.52717, lng: -69.91793, encargado: 'Jose Antonio', grupo: 'Grupo 42', direccion: 'Agencia 1104, G-42' },
  1106: { lat: 18.52772, lng: -69.91732, encargado: 'Jose Antonio', grupo: 'Grupo 42', direccion: 'Agencia 1106, G-42' },
  1120: { lat: 18.53008, lng: -69.91703, encargado: 'Jose Antonio', grupo: 'Grupo 42', direccion: 'Agencia 1120, G-42' },
  1121: { lat: 18.5306, lng: -69.91855, encargado: 'Jose Antonio', grupo: 'Grupo 42', direccion: 'Agencia 1121, G-42' },
  1122: { lat: 18.545414, lng: -69.889946, encargado: 'Jose Antonio', grupo: 'Grupo 42', direccion: 'Agencia 1122, G-42' },
  1140: { lat: 18.53924, lng: -69.88443, encargado: 'Jose Antonio', grupo: 'Grupo 42', direccion: 'Agencia 1140, G-42' },
  1141: { lat: 18.524952, lng: -69.917082, encargado: 'Jose Antonio', grupo: 'Grupo 42', direccion: 'Agencia 1141, G-42' },
  1143: { lat: 18.53424141, lng: -69.8978181, encargado: 'Jose Antonio', grupo: 'Grupo 42', direccion: 'Agencia 1143, G-42' },
  1154: { lat: 18.5252064, lng: -69.8994217, encargado: 'Jose Antonio', grupo: 'Grupo 42', direccion: 'Agencia 1154, G-42' },
  1155: { lat: 18.53134, lng: -69.9179, encargado: 'Jose Antonio', grupo: 'Grupo 42', direccion: 'Agencia 1155, G-42' },
  1156: { lat: 18.54334, lng: -69.90016, encargado: 'Jose Antonio', grupo: 'Grupo 42', direccion: 'Agencia 1156, G-42' },
  1164: { lat: 18.5203264, lng: -69.9094479, encargado: 'Jose Antonio', grupo: 'Grupo 42', direccion: 'Agencia 1164, G-42' },
  1165: { lat: 18.52414, lng: -69.91367, encargado: 'Jose Antonio', grupo: 'Grupo 42', direccion: 'Agencia 1165, G-42' },
  1172: { lat: 18.545443, lng: -69.89538, encargado: 'Jose Antonio', grupo: 'Grupo 42', direccion: 'Agencia 1172, G-42' },
  1202: { lat: 18.52437, lng: -69.91509, encargado: 'Jose Antonio', grupo: 'Grupo 42', direccion: 'Agencia 1202, G-42' },
  1203: { lat: 18.52487, lng: -69.91662, encargado: 'Jose Antonio', grupo: 'Grupo 42', direccion: 'Agencia 1203, G-42' },
  1204: { lat: 18.54137, lng: -69.90895, encargado: 'Jose Antonio', grupo: 'Grupo 42', direccion: 'Agencia 1204, G-42' },
  1205: { lat: 18.54023, lng: -69.90784, encargado: 'Jose Antonio', grupo: 'Grupo 42', direccion: 'Agencia 1205, G-42' },
  1206: { lat: 18.54397, lng: -69.90267, encargado: 'Jose Antonio', grupo: 'Grupo 42', direccion: 'Agencia 1206, G-42' },
49: { lat: 18.505546, lng: -69.911858, encargado: 'Yoscar G-8', grupo: 'Grupo 08', direccion: 'Agencia 49, G-08' },
  57: { lat: 18.5040991, lng: -69.9007856, encargado: 'Yoscar G-8', grupo: 'Grupo 08', direccion: 'Agencia 57, G-08' },
  67: { lat: 18.5038142, lng: -69.9122262, encargado: 'Yoscar G-8', grupo: 'Grupo 08', direccion: 'Agencia 67, G-08' },
  76: { lat: 18.5036870, lng: -69.9123912, encargado: 'Yoscar G-8', grupo: 'Grupo 08', direccion: 'Agencia 76, G-08' },
  87: { lat: 18.5044103, lng: -69.9109120, encargado: 'Yoscar G-8', grupo: 'Grupo 08', direccion: 'Agencia 87, G-08' },
  89: { lat: 18.5002208, lng: -69.9076625, encargado: 'Yoscar G-8', grupo: 'Grupo 08', direccion: 'Agencia 89, G-08' },
  107: { lat: 18.5057292, lng: -69.9110853, encargado: 'Yoscar G-8', grupo: 'Grupo 08', direccion: 'Agencia 107, G-08' },
  134: { lat: 18.504883, lng: -69.911505, encargado: 'Yoscar G-8', grupo: 'Grupo 08', direccion: 'Agencia 134, G-08' },
  156: { lat: 18.495380, lng: -69.907074, encargado: 'Yoscar G-8', grupo: 'Grupo 08', direccion: 'Agencia 156, G-08' },
  186: { lat: 18.500469, lng: -69.910669, encargado: 'Yoscar G-8', grupo: 'Grupo 08', direccion: 'Agencia 186, G-08' },
  202: { lat: 18.501330, lng: -69.911263, encargado: 'Yoscar G-8', grupo: 'Grupo 08', direccion: 'Agencia 202, G-08' },
  205: { lat: 18.504688, lng: -69.910542, encargado: 'Yoscar G-8', grupo: 'Grupo 08', direccion: 'Agencia 205, G-08' },
  207: { lat: 18.5025844, lng: -69.9141477, encargado: 'Yoscar G-8', grupo: 'Grupo 08', direccion: 'Agencia 207, G-08' },
  227: { lat: 18.503823, lng: -69.910863, encargado: 'Yoscar G-8', grupo: 'Grupo 08', direccion: 'Agencia 227, G-08' },
  238: { lat: 18.5052073, lng: -69.9083387, encargado: 'Yoscar G-8', grupo: 'Grupo 08', direccion: 'Agencia 238, G-08' },
  345: { lat: 18.495405, lng: -69.896972, encargado: 'Yoscar G-8', grupo: 'Grupo 08', direccion: 'Agencia 345, G-08' },
  359: { lat: 18.5023313, lng: -69.8889401, encargado: 'Yoscar G-8', grupo: 'Grupo 08', direccion: 'Agencia 359, G-08' },
  641: { lat: 18.502055, lng: -69.910437, encargado: 'Yoscar G-8', grupo: 'Grupo 08', direccion: 'Agencia 641, G-08' },
  652: { lat: 18.505830, lng: -69.892628, encargado: 'Yoscar G-8', grupo: 'Grupo 08', direccion: 'Agencia 652, G-08' },
  697: { lat: 18.506224, lng: -69.900391, encargado: 'Yoscar G-8', grupo: 'Grupo 08', direccion: 'Agencia 697, G-08' },
  705: { lat: 18.505062, lng: -69.896179, encargado: 'Yoscar G-8', grupo: 'Grupo 08', direccion: 'Agencia 705, G-08' },
  706: { lat: 18.502502, lng: -69.894073, encargado: 'Yoscar G-8', grupo: 'Grupo 08', direccion: 'Agencia 706, G-08' },
  707: { lat: 18.504635, lng: -69.894699, encargado: 'Yoscar G-8', grupo: 'Grupo 08', direccion: 'Agencia 707, G-08' },
  708: { lat: 18.502544, lng: -69.900697, encargado: 'Yoscar G-8', grupo: 'Grupo 08', direccion: 'Agencia 708, G-08' },
  711: { lat: 18.506239, lng: -69.898178, encargado: 'Yoscar G-8', grupo: 'Grupo 08', direccion: 'Agencia 711, G-08' },
  712: { lat: 18.499018, lng: -69.889442, encargado: 'Yoscar G-8', grupo: 'Grupo 08', direccion: 'Agencia 712, G-08' },
  713: { lat: 18.504665, lng: -69.896805, encargado: 'Yoscar G-8', grupo: 'Grupo 08', direccion: 'Agencia 713, G-08' },
  719: { lat: 18.5016209, lng: -69.893475, encargado: 'Yoscar G-8', grupo: 'Grupo 08', direccion: 'Agencia 719, G-08' },
  911: { lat: 18.50167855, lng: -69.8905241, encargado: 'Yoscar G-8', grupo: 'Grupo 08', direccion: 'Agencia 911, G-08' },
  972: { lat: 18.503973, lng: -69.895645, encargado: 'Yoscar G-8', grupo: 'Grupo 08', direccion: 'Agencia 972, G-08' },
  973: { lat: 18.506737, lng: -69.899078, encargado: 'Yoscar G-8', grupo: 'Grupo 08', direccion: 'Agencia 973, G-08' },
  980: { lat: 18.5009644, lng: -69.8970246, encargado: 'Yoscar G-8', grupo: 'Grupo 08', direccion: 'Agencia 980, G-08' },
  982: { lat: 18.505713, lng: -69.895164, encargado: 'Yoscar G-8', grupo: 'Grupo 08', direccion: 'Agencia 982, G-08' },
  4: { lat: 18.5058105, lng: -69.9199403, encargado: 'Alejandro G-06', grupo: 'Grupo 06', direccion: 'Agencia 4, G-06' },
  11: { lat: 18.5003266, lng: -69.9305259, encargado: 'Alejandro G-06', grupo: 'Grupo 06', direccion: 'Agencia 11, G-06' },
  28: { lat: 18.5033045, lng: -69.9190384, encargado: 'Alejandro G-06', grupo: 'Grupo 06', direccion: 'Agencia 28, G-06' },
  37: { lat: 18.5028429, lng: -69.9258874, encargado: 'Alejandro G-06', grupo: 'Grupo 06', direccion: 'Agencia 37, G-06' },
  44: { lat: 18.5066827, lng: -69.9189945, encargado: 'Alejandro G-06', grupo: 'Grupo 06', direccion: 'Agencia 44, G-06' },
  45: { lat: 18.496240, lng: -69.927400, encargado: 'Alejandro G-06', grupo: 'Grupo 06', direccion: 'Agencia 45, G-06' },
  54: { lat: 18.5047594, lng: -69.9501349, encargado: 'Alejandro G-06', grupo: 'Grupo 06', direccion: 'Agencia 54, G-06' },
  55: { lat: 18.5047906, lng: -69.9272097, encargado: 'Alejandro G-06', grupo: 'Grupo 06', direccion: 'Agencia 55, G-06' },
  60: { lat: 18.505252, lng: -69.927339, encargado: 'Alejandro G-06', grupo: 'Grupo 06', direccion: 'Agencia 60, G-06' },
  62: { lat: 18.5035993, lng: -69.9169563, encargado: 'Alejandro G-06', grupo: 'Grupo 06', direccion: 'Agencia 62, G-06' },
  63: { lat: 18.5089068, lng: -69.9215312, encargado: 'Alejandro G-06', grupo: 'Grupo 06', direccion: 'Agencia 63, G-06' },
  64: { lat: 18.4866142, lng: -69.9295027, encargado: 'Alejandro G-06', grupo: 'Grupo 06', direccion: 'Agencia 64, G-06' },
  66: { lat: 18.4906473, lng: -69.9684125, encargado: 'Alejandro G-06', grupo: 'Grupo 06', direccion: 'Agencia 66, G-06' },
  68: { lat: 18.5035334, lng: -69.9269244, encargado: 'Alejandro G-06', grupo: 'Grupo 06', direccion: 'Agencia 68, G-06' },
  71: { lat: 18.50058439, lng: -69.96078681, encargado: 'Alejandro G-06', grupo: 'Grupo 06', direccion: 'Agencia 71, G-06' },
  86: { lat: 18.4969945, lng: -69.9309960, encargado: 'Alejandro G-06', grupo: 'Grupo 06', direccion: 'Agencia 86, G-06' },
  93: { lat: 18.5026229, lng: -69.9158576, encargado: 'Alejandro G-06', grupo: 'Grupo 06', direccion: 'Agencia 93, G-06' },
  94: { lat: 18.5022559, lng: -69.9187692, encargado: 'Alejandro G-06', grupo: 'Grupo 06', direccion: 'Agencia 94, G-06' },
  95: { lat: 18.5030623, lng: -69.9255236, encargado: 'Alejandro G-06', grupo: 'Grupo 06', direccion: 'Agencia 95, G-06' },
  105: { lat: 18.5007276, lng: -69.9429771, encargado: 'Alejandro G-06', grupo: 'Grupo 06', direccion: 'Agencia 105, G-06' },
  117: { lat: 18.5007298, lng: -69.9220458, encargado: 'Alejandro G-06', grupo: 'Grupo 06', direccion: 'Agencia 117, G-06' },
  126: { lat: 18.5033780, lng: -69.9186049, encargado: 'Alejandro G-06', grupo: 'Grupo 06', direccion: 'Agencia 126, G-06' },
  133: { lat: 18.5053702, lng: -69.9191470, encargado: 'Alejandro G-06', grupo: 'Grupo 06', direccion: 'Agencia 133, G-06' },
  135: { lat: 18.497597, lng: -69.925230, encargado: 'Alejandro G-06', grupo: 'Grupo 06', direccion: 'Agencia 135, G-06' },
  161: { lat: 18.500484, lng: -69.9256383, encargado: 'Alejandro G-06', grupo: 'Grupo 06', direccion: 'Agencia 161, G-06' },
  191: { lat: 18.501163, lng: -69.939542, encargado: 'Alejandro G-06', grupo: 'Grupo 06', direccion: 'Agencia 191, G-06' },
  197: { lat: 18.4886419, lng: -69.9329403, encargado: 'Alejandro G-06', grupo: 'Grupo 06', direccion: 'Agencia 197, G-06' },
  198: { lat: 18.5006869, lng: -69.9253895, encargado: 'Alejandro G-06', grupo: 'Grupo 06', direccion: 'Agencia 198, G-06' },
  226: { lat: 18.497185, lng: -69.925114, encargado: 'Alejandro G-06', grupo: 'Grupo 06', direccion: 'Agencia 226, G-06' },
  229: { lat: 18.503207, lng: -69.916944, encargado: 'Alejandro G-06', grupo: 'Grupo 06', direccion: 'Agencia 229, G-06' },
  349: { lat: 18.488236, lng: -69.932912, encargado: 'Alejandro G-06', grupo: 'Grupo 06', direccion: 'Agencia 349, G-06' },
  350: { lat: 18.493042, lng: -69.933429, encargado: 'Alejandro G-06', grupo: 'Grupo 06', direccion: 'Agencia 350, G-06' },
  352: { lat: 18.501009, lng: -69.927300, encargado: 'Alejandro G-06', grupo: 'Grupo 06', direccion: 'Agencia 352, G-06' },
  353: { lat: 18.508539, lng: -69.920136, encargado: 'Alejandro G-06', grupo: 'Grupo 06', direccion: 'Agencia 353, G-06' },
  355: { lat: 18.492370, lng: -69.930822, encargado: 'Alejandro G-06', grupo: 'Grupo 06', direccion: 'Agencia 355, G-06' },
  356: { lat: 18.491972, lng: -69.929819, encargado: 'Alejandro G-06', grupo: 'Grupo 06', direccion: 'Agencia 356, G-06' },
  357: { lat: 18.490612, lng: -69.929814, encargado: 'Alejandro G-06', grupo: 'Grupo 06', direccion: 'Agencia 357, G-06' },
  358: { lat: 18.498774, lng: -69.941529, encargado: 'Alejandro G-06', grupo: 'Grupo 06', direccion: 'Agencia 358, G-06' },
  639: { lat: 18.506090, lng: -69.916931, encargado: 'Alejandro G-06', grupo: 'Grupo 06', direccion: 'Agencia 639, G-06' },
  640: { lat: 18.505021, lng: -69.921647, encargado: 'Alejandro G-06', grupo: 'Grupo 06', direccion: 'Agencia 640, G-06' },
  661: { lat: 18.503735, lng: -69.928124, encargado: 'Alejandro G-06', grupo: 'Grupo 06', direccion: 'Agencia 661, G-06' },
  665: { lat: 18.484830, lng: -69.928484, encargado: 'Alejandro G-06', grupo: 'Grupo 06', direccion: 'Agencia 665, G-06' },
  668: { lat: 18.5061046, lng: -69.921038, encargado: 'Alejandro G-06', grupo: 'Grupo 06', direccion: 'Agencia 668, G-06' },
  676: { lat: 18.483758, lng: -69.931459, encargado: 'Alejandro G-06', grupo: 'Grupo 06', direccion: 'Agencia 676, G-06' },
  693: { lat: 18.498692, lng: -69.932816, encargado: 'Alejandro G-06', grupo: 'Grupo 06', direccion: 'Agencia 693, G-06' },
  821: { lat: 18.490347, lng: -69.931694, encargado: 'Alejandro G-06', grupo: 'Grupo 06', direccion: 'Agencia 821, G-06' },
  823: { lat: 18.5046155, lng: -69.9179521, encargado: 'Alejandro G-06', grupo: 'Grupo 06', direccion: 'Agencia 823, G-06' },
  824: { lat: 18.50124997, lng: -69.923194660, encargado: 'Alejandro G-06', grupo: 'Grupo 06', direccion: 'Agencia 824, G-06' },
  825: { lat: 18.495187, lng: -69.964863, encargado: 'Alejandro G-06', grupo: 'Grupo 06', direccion: 'Agencia 825, G-06' },
  826: { lat: 18.49131194, lng: -69.92995779, encargado: 'Alejandro G-06', grupo: 'Grupo 06', direccion: 'Agencia 826, G-06' },
  827: { lat: 18.48472598, lng: -69.92852424, encargado: 'Alejandro G-06', grupo: 'Grupo 06', direccion: 'Agencia 827, G-06' },
  828: { lat: 18.499975, lng: -69.928520, encargado: 'Alejandro G-06', grupo: 'Grupo 06', direccion: 'Agencia 828, G-06' },
  829: { lat: 18.501028, lng: -69.926071, encargado: 'Alejandro G-06', grupo: 'Grupo 06', direccion: 'Agencia 829, G-06' },
  1260: { lat: 18.491223, lng: -69.930937, encargado: 'Alejandro G-06', grupo: 'Grupo 06', direccion: 'Agencia 1260, G-06' },
  1261: { lat: 18.493385, lng: -69.928805, encargado: 'Alejandro G-06', grupo: 'Grupo 06', direccion: 'Agencia 1261, G-06' },
  1266: { lat: 18.498344, lng: -69.960281, encargado: 'Alejandro G-06', grupo: 'Grupo 06', direccion: 'Agencia 1266, G-06' },
  1267: { lat: 18.497601, lng: -69.923088, encargado: 'Alejandro G-06', grupo: 'Grupo 06', direccion: 'Agencia 1267, G-06' },
  1268: { lat: 18.506374, lng: -69.936279, encargado: 'Alejandro G-06', grupo: 'Grupo 06', direccion: 'Agencia 1268, G-06' },
  1270: { lat: 18.492954, lng: -69.966324, encargado: 'Alejandro G-06', grupo: 'Grupo 06', direccion: 'Agencia 1270, G-06' }
,
  9: { lat: 18.4881227, lng: -69.8981624, encargado: 'Juan Gavilan', grupo: 'Grupo 03', direccion: 'Agencia 0009, G-03' },
  31: { lat: 18.4894839, lng: -69.9006243, encargado: 'Juan Gavilan', grupo: 'Grupo 03', direccion: 'Agencia 0031, G-03' },
  33: { lat: 18.4869105, lng: -69.9017539, encargado: 'Juan Gavilan', grupo: 'Grupo 03', direccion: 'Agencia 0033, G-03' },
  38: { lat: 18.492920, lng: -69.885770, encargado: 'Juan Gavilan', grupo: 'Grupo 03', direccion: 'Agencia 0038, G-03' },
  39: { lat: 18.4871321, lng: -69.8967679, encargado: 'Juan Gavilan', grupo: 'Grupo 03', direccion: 'Agencia 0039, G-03' },
  46: { lat: 18.4904645, lng: -69.9011353, encargado: 'Juan Gavilan', grupo: 'Grupo 03', direccion: 'Agencia 0046, G-03' },
  69: { lat: 18.4876934, lng: -69.8992886, encargado: 'Juan Gavilan', grupo: 'Grupo 03', direccion: 'Agencia 0069, G-03' },
  80: { lat: 18.4888003, lng: -69.9024999, encargado: 'Juan Gavilan', grupo: 'Grupo 03', direccion: 'Agencia 0080, G-03' },
  85: { lat: 18.4894581, lng: -69.8924979, encargado: 'Juan Gavilan', grupo: 'Grupo 03', direccion: 'Agencia 0085, G-03' },
  101: { lat: 18.4882664, lng: -69.9007950, encargado: 'Juan Gavilan', grupo: 'Grupo 03', direccion: 'Agencia 0101, G-03' },
  108: { lat: 18.4864231, lng: -69.9026632, encargado: 'Juan Gavilan', grupo: 'Grupo 03', direccion: 'Agencia 0108, G-03' },
  113: { lat: 18.4884161, lng: -69.9034644, encargado: 'Juan Gavilan', grupo: 'Grupo 03', direccion: 'Agencia 0113, G-03' },
  136: { lat: 18.4859509, lng: -69.8911370, encargado: 'Juan Gavilan', grupo: 'Grupo 03', direccion: 'Agencia 0136, G-03' },
  137: { lat: 18.4903027, lng: -69.9026997, encargado: 'Juan Gavilan', grupo: 'Grupo 03', direccion: 'Agencia 0137, G-03' },
  192: { lat: 18.4871540, lng: -69.8980100, encargado: 'Juan Gavilan', grupo: 'Grupo 03', direccion: 'Agencia 0192, G-03' },
  222: { lat: 18.4871726, lng: -69.9011631, encargado: 'Juan Gavilan', grupo: 'Grupo 03', direccion: 'Agencia 0222, G-03' },
  223: { lat: 18.4882661, lng: -69.9007353, encargado: 'Juan Gavilan', grupo: 'Grupo 03', direccion: 'Agencia 0223, G-03' },
  246: { lat: 18.4898343, lng: -69.9026005, encargado: 'Juan Gavilan', grupo: 'Grupo 03', direccion: 'Agencia 0246, G-03' },
  644: { lat: 18.493979, lng: -69.895757, encargado: 'Juan Gavilan', grupo: 'Grupo 03', direccion: 'Agencia 0644, G-03' },
  675: { lat: 18.490011, lng: -69.899490, encargado: 'Juan Gavilan', grupo: 'Grupo 03', direccion: 'Agencia 0675, G-03' },
  47: { lat: 18.449236, lng: -69.959876, encargado: 'Manuel Gomez', grupo: 'Grupo 04', direccion: 'Agencia 0047, G-04' },
  61: { lat: 18.452814, lng: -69.965666, encargado: 'Manuel Gomez', grupo: 'Grupo 04', direccion: 'Agencia 0061, G-04' },
  119: { lat: 18.478292, lng: -69.962009, encargado: 'Manuel Gomez', grupo: 'Grupo 04', direccion: 'Agencia 0119, G-04' },
  148: { lat: 18.455851, lng: -69.946056, encargado: 'Manuel Gomez', grupo: 'Grupo 04', direccion: 'Agencia 0148, G-04' },
  155: { lat: 18.4580828, lng: -69.9417987, encargado: 'Manuel Gomez', grupo: 'Grupo 04', direccion: 'Agencia 0155, G-04' },
  163: { lat: 18.4624826, lng: -69.9587595, encargado: 'Manuel Gomez', grupo: 'Grupo 04', direccion: 'Agencia 0163, G-04' },
  169: { lat: 18.484676, lng: -69.952290, encargado: 'Manuel Gomez', grupo: 'Grupo 04', direccion: 'Agencia 0169, G-04' },
  182: { lat: 18.457245, lng: -69.942162, encargado: 'Manuel Gomez', grupo: 'Grupo 04', direccion: 'Agencia 0182, G-04' },
  185: { lat: 18.4751114, lng: -69.9358749, encargado: 'Manuel Gomez', grupo: 'Grupo 04', direccion: 'Agencia 0185, G-04' },
  225: { lat: 18.4518784, lng: -69.9660392, encargado: 'Manuel Gomez', grupo: 'Grupo 04', direccion: 'Agencia 0225, G-04' },
  230: { lat: 18.472964, lng: -69.961856, encargado: 'Manuel Gomez', grupo: 'Grupo 04', direccion: 'Agencia 0230, G-04' },
  232: { lat: 18.474279, lng: -69.961335, encargado: 'Manuel Gomez', grupo: 'Grupo 04', direccion: 'Agencia 0232, G-04' },
  233: { lat: 18.470513, lng: -69.959557, encargado: 'Manuel Gomez', grupo: 'Grupo 04', direccion: 'Agencia 0233, G-04' },
  241: { lat: 18.458872, lng: -69.940879, encargado: 'Manuel Gomez', grupo: 'Grupo 04', direccion: 'Agencia 0241, G-04' },
  242: { lat: 18.458443, lng: -69.936478, encargado: 'Manuel Gomez', grupo: 'Grupo 04', direccion: 'Agencia 0242, G-04' },
  248: { lat: 18.456954, lng: -69.943561, encargado: 'Manuel Gomez', grupo: 'Grupo 04', direccion: 'Agencia 0248, G-04' },
  651: { lat: 18.4776463, lng: -69.9545068, encargado: 'Manuel Gomez', grupo: 'Grupo 04', direccion: 'Agencia 0651, G-04' },
  1230: { lat: 18.4759006, lng: -69.9534522, encargado: 'Manuel Gomez', grupo: 'Grupo 04', direccion: 'Agencia 1230, G-04' },
  1231: { lat: 18.480167458, lng: -69.933550, encargado: 'Manuel Gomez', grupo: 'Grupo 04', direccion: 'Agencia 1231, G-04' },
  3: { lat: 18.504334, lng: -69.8615992, encargado: 'Norberto Reyes', grupo: 'Grupo 05', direccion: 'Agencia 0003, G-05' },
  10: { lat: 18.5029605, lng: -69.8599899, encargado: 'Norberto Reyes', grupo: 'Grupo 05', direccion: 'Agencia 0010, G-05' },
  27: { lat: 18.5051581, lng: -69.8619103, encargado: 'Norberto Reyes', grupo: 'Grupo 05', direccion: 'Agencia 0027, G-05' },
  32: { lat: 18.5055956, lng: -69.8556876, encargado: 'Norberto Reyes', grupo: 'Grupo 05', direccion: 'Agencia 0032, G-05' },
  75: { lat: 18.5281602, lng: -69.843049, encargado: 'Norberto Reyes', grupo: 'Grupo 05', direccion: 'Agencia 0075, G-05' },
  92: { lat: 18.5111763, lng: -69.8483635, encargado: 'Norberto Reyes', grupo: 'Grupo 05', direccion: 'Agencia 0092, G-05' },
  97: { lat: 18.520908, lng: -69.848129, encargado: 'Norberto Reyes', grupo: 'Grupo 05', direccion: 'Agencia 0097, G-05' },
  427: { lat: 18.504190, lng: -69.855832, encargado: 'Norberto Reyes', grupo: 'Grupo 05', direccion: 'Agencia 0427, G-05' },
  431: { lat: 18.505661, lng: -69.871056, encargado: 'Norberto Reyes', grupo: 'Grupo 05', direccion: 'Agencia 0431, G-05' },
  1256: { lat: 18.51394703, lng: -69.84554, encargado: 'Norberto Reyes', grupo: 'Grupo 05', direccion: 'Agencia 1256, G-05' },
  480: { lat: 18.497283148, lng: -69.85954728, encargado: 'Norberto Reyes', grupo: 'Grupo 05', direccion: 'Agencia 0480, G-05' },
  484: { lat: 18.505438, lng: -69.864682, encargado: 'Norberto Reyes', grupo: 'Grupo 05', direccion: 'Agencia 0484, G-05' },
  488: { lat: 18.516384, lng: -69.861330, encargado: 'Norberto Reyes', grupo: 'Grupo 05', direccion: 'Agencia 0488, G-05' },
  489: { lat: 18.512833, lng: -69.860304, encargado: 'Norberto Reyes', grupo: 'Grupo 05', direccion: 'Agencia 0489, G-05' },
  490: { lat: 18.514267, lng: -69.861214, encargado: 'Norberto Reyes', grupo: 'Grupo 05', direccion: 'Agencia 0490, G-05' },
  499: { lat: 18.516104, lng: -69.877678, encargado: 'Norberto Reyes', grupo: 'Grupo 05', direccion: 'Agencia 0499, G-05' },
  602: { lat: 18.514755, lng: -69.875504, encargado: 'Norberto Reyes', grupo: 'Grupo 05', direccion: 'Agencia 0602, G-05' },
  604: { lat: 18.520748, lng: -69.859428, encargado: 'Norberto Reyes', grupo: 'Grupo 05', direccion: 'Agencia 0604, G-05' },
  605: { lat: 18.529154, lng: -69.846886, encargado: 'Norberto Reyes', grupo: 'Grupo 05', direccion: 'Agencia 0605, G-05' },
  607: { lat: 18.505621, lng: -69.870105, encargado: 'Norberto Reyes', grupo: 'Grupo 05', direccion: 'Agencia 0607, G-05' }

};

function createAgencyRecord(numero, grupo, encargado) {
  const geo = AGENCY_GEO_CATALOG[numero] || {};
  const equipos = equiposBaseAgencia.map((item, i) => ({
    ...item,
    serial: `${item.serial}-${numero}`,
    id: `${numero}-${i+1}`
  }));
  return {
    numero,
    nombre: `Agencia ${String(numero).padStart(4, '0')}`,
    grupo: geo.grupo || grupo,
    encargado: geo.encargado || encargado,
    direccion: geo.direccion || `Agencia ${String(numero).padStart(4, '0')}, ${String(grupo || '').replace('Grupo ', 'G-')}`,
    latitud: typeof geo.lat === 'number' ? geo.lat : null,
    longitud: typeof geo.lng === 'number' ? geo.lng : null,
    equipos
  };
}

const AGENCIAS_GRUPO_44_COMPLETAS = [435,1000,1002,1005,1006,1009,1012,1014,1016,1078,1079,1081,1082,1083,1084,1085,1086,1088,1099,1107,1111,1112,1123,1130,1133,1134,1137,1139,1152,1166,1170,1183,1184,1185,1186,1187,1188,1189];
const AGENCIAS_GRUPO_45_COMPLETAS = [147,449,468,469,1001,1003,1013,1015,1017,1039,1074,1075,1076,1080,1091,1108,1113,1135,1136,1138,1144,1145,1146,1147,1148,1149,1150,1169,1173,1178,1179,1180,1181,1182,1194,1195,1196,1197,1198,1199,1200,1201,1211,1212];
const AGENCIAS_GRUPO_42_COMPLETAS = [20,40,78,164,171,172,173,383,384,385,386,387,388,389,390,392,433,434,436,437,438,441,442,443,444,1004,1007,1008,1010,1011,1019,1020,1036,1037,1103,1104,1106,1120,1121,1122,1140,1141,1143,1154,1155,1156,1164,1165,1172,1202,1203,1204,1205,1206];
const AGENCIAS_GRUPO_08_COMPLETAS = [49,57,67,76,87,89,107,134,156,186,202,205,207,227,238,345,359,641,652,697,705,706,707,708,711,712,713,719,911,972,973,980,982];
const AGENCIAS_GRUPO_06_COMPLETAS = [4,11,28,37,44,45,54,55,60,62,63,64,66,68,71,86,93,94,95,105,117,126,133,135,161,191,197,198,226,229,349,350,352,353,355,356,357,358,639,640,661,665,668,676,693,821,823,824,825,826,827,828,829,1260,1261,1266,1267,1268,1270];
const AGENCIAS_GRUPO_01_COMPLETAS = [9,31,33,38,39,46,69,80,85,101,108,113,136,137,192,222,223,246,644,675];
const AGENCIAS_GRUPO_04_COMPLETAS = [47,61,119,148,155,163,169,182,185,225,230,232,233,241,242,248,651,1230,1231];
const AGENCIAS_GRUPO_05_COMPLETAS = [3,10,27,32,75,92,97,427,431,1256,480,484,488,489,490,499,602,604,605,607];

// Tipos de agencia FIJOS solicitados por Oscar.
// Todas las demás agencias quedan como "Agencia" normal hasta que se editen manualmente.
const AGENCY_TYPE_FIXED = {
  1000: 'Centro De Pago',
  101: 'Centro De Pago',
  147: 'Agencia en Supermercado',
  185: 'Punto de Pago',
  10: 'Centro De Pago',
  32: 'Punto de Pago',
  92: 'Punto de Pago',

  1108: 'Centro De Pago',
  227: 'Centro De Pago',
  28: 'Centro De Pago',
  383: 'Centro De Pago',

  1015: 'Punto de Pago',
  1075: 'Punto de Pago',
  1200: 'Punto de Pago',
  1079: 'Punto de Pago',
  1085: 'Punto de Pago',
  1166: 'Punto de Pago',
  89: 'Punto de Pago',
  829: 'Punto de Pago',
  64: 'Punto de Pago',
  117: 'Punto de Pago',
  93: 'Punto de Pago',
  676: 'Punto de Pago',
  827: 'Punto de Pago',
  826: 'Punto de Pago',
  164: 'Punto de Pago',
  1203: 'Punto de Pago',
  1008: 'Punto de Pago',
  1010: 'Punto de Pago',
  1036: 'Punto de Pago',
  1140: 'Punto de Pago',
  1103: 'Punto de Pago'
};

function getFixedAgencyType(numero){
  return AGENCY_TYPE_FIXED[Number(numero)] || null;
}


const AGENCY_SPECIAL_CLOSED_GROUP = 'DESACTIVADAS/CERRADAS';
const AGENCY_STATUS_DEFAULT = 'ACTIVA';
const AGENCY_STATUS_OPTIONS = ['ACTIVA','EN CONSTRUCCIÓN','EN PROCESO','REMODELACIÓN','DESACTIVADA/CERRADA'];

function normalizarEstadoAgencia(estado){
  const raw = String(estado ?? '').trim();
  const clean = raw.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/\s+/g,' ');
  if(clean.includes('constru')) return 'EN CONSTRUCCIÓN';
  if(clean.includes('proceso') || clean.includes('revision') || clean.includes('pendiente') || clean.includes('instalacion')) return 'EN PROCESO';
  if(clean.includes('remodel')) return 'REMODELACIÓN';
  if(clean.includes('desactiv') || clean.includes('cerrad') || clean.includes('inactiv') || clean.includes('clausur') || clean.includes('cancel')) return 'DESACTIVADA/CERRADA';
  if(!clean || clean.includes('activa') || clean.includes('activo') || clean.includes('abierta') || clean.includes('servicio') || clean.includes('operando')) return 'ACTIVA';
  return 'ACTIVA';
}

function getAgencyEstadoOperativo(agencia){
  return normalizarEstadoAgencia(
    agencia?.estado_operativo ||
    agencia?.detalle?.estadoOperativo ||
    agencia?.estadoOperativo ||
    agencia?.estado ||
    agencia?.status ||
    agencia?.estado_agencia ||
    AGENCY_STATUS_DEFAULT
  );
}

function agencyStatusClass(estado){
  const clean = normalizarEstadoAgencia(estado);
  if(clean === 'EN CONSTRUCCIÓN' || clean === 'EN PROCESO') return 'status-en-proceso';
  if(clean === 'REMODELACIÓN') return 'status-remodelacion';
  if(clean === 'DESACTIVADA/CERRADA') return 'status-cerrada';
  return 'status-activa';
}

function agencyStatusLabel(estado){
  return normalizarEstadoAgencia(estado);
}

function agencyStatusOptionsHtml(selected){
  const current = normalizarEstadoAgencia(selected || AGENCY_STATUS_DEFAULT);
  return AGENCY_STATUS_OPTIONS.map(op => `<option value="${op}" ${current === op ? 'selected' : ''}>${op}</option>`).join('');
}


function isAgencyClosedStatus(estado){
  return normalizarEstadoAgencia(estado) === 'DESACTIVADA/CERRADA';
}

function getAgencyRealGroup(agencia){
  const detalle = agencia?.detalle || {};
  const current = String(agencia?.grupo || '').trim();
  const stored = String(detalle.grupoReal || agencia?.grupoReal || detalle.grupoAnterior || agencia?.grupoOriginal || '').trim();
  if(stored && stored !== AGENCY_SPECIAL_CLOSED_GROUP) return stored;
  if(current && current !== AGENCY_SPECIAL_CLOSED_GROUP) return current;
  return 'Grupo 00';
}

function applyAgencyClosedStatusRule(agencia, requestedGroup){
  if(!agencia) return agencia;
  if(!agencia.detalle) agencia.detalle = {};
  const estado = getAgencyEstadoOperativo(agencia);
  const requested = String(requestedGroup || '').trim();
  const current = String(agencia.grupo || '').trim();
  const previousReal = String(agencia.detalle.grupoReal || agencia.grupoReal || agencia.detalle.grupoAnterior || '').trim();
  let realGroup = '';

  if(requested && requested !== AGENCY_SPECIAL_CLOSED_GROUP){
    realGroup = requested;
  } else if(current && current !== AGENCY_SPECIAL_CLOSED_GROUP){
    realGroup = current;
  } else if(previousReal && previousReal !== AGENCY_SPECIAL_CLOSED_GROUP){
    realGroup = previousReal;
  }

  if(estado === 'DESACTIVADA/CERRADA'){
    if(realGroup){
      agencia.detalle.grupoReal = realGroup;
      agencia.grupoReal = realGroup;
    }
    agencia.grupo = AGENCY_SPECIAL_CLOSED_GROUP;
  } else {
    agencia.grupo = realGroup || current || 'Grupo 00';
    if(agencia.grupo !== AGENCY_SPECIAL_CLOSED_GROUP){
      agencia.detalle.grupoReal = agencia.grupo;
      agencia.grupoReal = agencia.grupo;
    }
  }

  agencia.estadoOperativo = estado;
  agencia.detalle.estadoOperativo = estado;
  return agencia;
}

function syncClosedAgenciesGroup(){
  if(!Array.isArray(agencias)) return;
  agencias.forEach(agencia => applyAgencyClosedStatusRule(agencia));
  if(Array.isArray(grupos)){
    const closedGroup = grupos.find(g => String(g.nombre || '').trim() === AGENCY_SPECIAL_CLOSED_GROUP);
    if(closedGroup){
      closedGroup.agencias = agencias
        .filter(a => getAgencyEstadoOperativo(a) === 'DESACTIVADA/CERRADA')
        .map(a => Number(a.numero));
    }
  }
}


const GRUPO_44_COORDENADAS_ADICIONALES = {};

let agencias = [
  ...AGENCIAS_GRUPO_44_COMPLETAS.map((numero) => createAgencyRecord(numero, 'Grupo 44', 'encargado1')),
  ...AGENCIAS_GRUPO_45_COMPLETAS.map((numero) => createAgencyRecord(numero, 'Grupo 45', 'Jose Pacheco')),
  ...AGENCIAS_GRUPO_42_COMPLETAS.map((numero) => createAgencyRecord(numero, 'Grupo 42', 'Jose Antonio')),
  ...AGENCIAS_GRUPO_08_COMPLETAS.map((numero) => createAgencyRecord(numero, 'Grupo 08', 'Yoscar G-8')),
  ...AGENCIAS_GRUPO_06_COMPLETAS.map((numero) => createAgencyRecord(numero, 'Grupo 06', 'Alejandro G-06')),
  ...AGENCIAS_GRUPO_01_COMPLETAS.map((numero) => createAgencyRecord(numero, 'Grupo 03', 'Juan Gavilan')),
  ...AGENCIAS_GRUPO_04_COMPLETAS.map((numero) => createAgencyRecord(numero, 'Grupo 04', 'Manuel Gomez')),
  ...AGENCIAS_GRUPO_05_COMPLETAS.map((numero) => createAgencyRecord(numero, 'Grupo 05', 'Norberto Reyes'))
];

AGENCIAS_GRUPO_44_COMPLETAS.forEach((numero) => {
  const existe = agencias.some((agencia) => Number(agencia.numero) === Number(numero));
  if (!existe) {
    agencias.push(createAgencyRecord(numero, 'Grupo 44', 'encargado1'));
  }
});

AGENCIAS_GRUPO_45_COMPLETAS.forEach((numero) => {
  const existe = agencias.some((agencia) => Number(agencia.numero) === Number(numero));
  if (!existe) {
    agencias.push(createAgencyRecord(numero, 'Grupo 45', 'Jose Pacheco'));
  }
});

AGENCIAS_GRUPO_42_COMPLETAS.forEach((numero) => {
  const existe = agencias.some((agencia) => Number(agencia.numero) === Number(numero));
  if (!existe) {
    agencias.push(createAgencyRecord(numero, 'Grupo 42', 'Jose Antonio'));
  }
});

AGENCIAS_GRUPO_08_COMPLETAS.forEach((numero) => {
  const existe = agencias.some((agencia) => Number(agencia.numero) === Number(numero));
  if (!existe) {
    agencias.push(createAgencyRecord(numero, 'Grupo 08', 'Yoscar G-8'));
  }
});

AGENCIAS_GRUPO_06_COMPLETAS.forEach((numero) => {
  const existe = agencias.some((agencia) => Number(agencia.numero) === Number(numero));
  if (!existe) {
    agencias.push(createAgencyRecord(numero, 'Grupo 06', 'Alejandro G-06'));
  }
});

AGENCIAS_GRUPO_01_COMPLETAS.forEach((numero) => {
  const existe = agencias.some((agencia) => Number(agencia.numero) === Number(numero));
  if (!existe) {
    agencias.push(createAgencyRecord(numero, 'Grupo 03', 'Juan Gavilan'));
  }
});

AGENCIAS_GRUPO_04_COMPLETAS.forEach((numero) => {
  const existe = agencias.some((agencia) => Number(agencia.numero) === Number(numero));
  if (!existe) {
    agencias.push(createAgencyRecord(numero, 'Grupo 04', 'Manuel Gomez'));
  }
});

AGENCIAS_GRUPO_05_COMPLETAS.forEach((numero) => {
  const existe = agencias.some((agencia) => Number(agencia.numero) === Number(numero));
  if (!existe) {
    agencias.push(createAgencyRecord(numero, 'Grupo 05', 'Norberto Reyes'));
  }
});

agencias = agencias.map((agencia) => {
  const numero = Number(agencia.numero);
  const geo = AGENCY_GEO_CATALOG[numero] || {};
  const geoGrupo44 = GRUPO_44_COORDENADAS_ADICIONALES[numero] || {};
  return {
    ...agencia,
    grupo: geo.grupo || agencia.grupo,
    encargado: geo.encargado || agencia.encargado,
    direccion: geo.direccion || agencia.direccion,
    latitud: typeof geo.lat === 'number' ? geo.lat : (typeof geoGrupo44.lat === 'number' ? geoGrupo44.lat : agencia.latitud),
    longitud: typeof geo.lng === 'number' ? geo.lng : (typeof geoGrupo44.lng === 'number' ? geoGrupo44.lng : agencia.longitud),
    detalle: {
      ...(agencia.detalle || {}),
      tipoAgencia: getFixedAgencyType(numero) || agencia.detalle?.tipoAgencia || agencia.tipoAgencia || 'Agencia',
      estadoOperativo: getAgencyEstadoOperativo(agencia)
    },
    tipoAgencia: getFixedAgencyType(numero) || agencia.tipoAgencia || agencia.detalle?.tipoAgencia || 'Agencia',
    estadoOperativo: getAgencyEstadoOperativo(agencia)
  };
});

agencias.forEach(agencia => applyAgencyClosedStatusRule(agencia));

let grupos = [
  {numero:'44', nombre:'Grupo 44', color:'#89c541', encargado:'encargado1', flota:'(829) 340-6805', extension:'1144', correo:'encargado1@grupoortiz.com.do', custodia:[], agencias:AGENCIAS_GRUPO_44_COMPLETAS.slice()},
  {numero:'45', nombre:'Grupo 45', color:'#2d9bf0', encargado:'Jose Pacheco', flota:'', extension:'', correo:'', custodia:[], agencias:AGENCIAS_GRUPO_45_COMPLETAS.slice()},
  {numero:'42', nombre:'Grupo 42', color:'#d43ad7', encargado:'Jose Antonio', flota:'', extension:'', correo:'', custodia:[], agencias:AGENCIAS_GRUPO_42_COMPLETAS.slice()},
  {numero:'08', nombre:'Grupo 08', color:'#00b8ff', encargado:'Yoscar G-8', flota:'', extension:'', correo:'', custodia:[], agencias:AGENCIAS_GRUPO_08_COMPLETAS.slice()},
  {numero:'06', nombre:'Grupo 06', color:'#16c172', encargado:'Alejandro G-06', flota:'', extension:'', correo:'', custodia:[], agencias:AGENCIAS_GRUPO_06_COMPLETAS.slice()},
  {numero:'03', nombre:'Grupo 03', color:'#0ea5c6', encargado:'Juan Gavilan', flota:'', extension:'', correo:'', custodia:[], agencias:AGENCIAS_GRUPO_01_COMPLETAS.slice()},
  {numero:'04', nombre:'Grupo 04', color:'#f59e0b', encargado:'Manuel Gomez', flota:'', extension:'', correo:'', custodia:[], agencias:AGENCIAS_GRUPO_04_COMPLETAS.slice()},
  {numero:'05', nombre:'Grupo 05', color:'#6366f1', encargado:'Norberto Reyes', flota:'', extension:'', correo:'', custodia:[], agencias:AGENCIAS_GRUPO_05_COMPLETAS.slice()},
  {numero:'00', nombre:AGENCY_SPECIAL_CLOSED_GROUP, color:'#4b5563', encargado:'Sistema', flota:'', extension:'', correo:'', custodia:[], agencias:[]}
];
syncClosedAgenciesGroup();
let editGrupoIndex = null;
let detalleGrupoActualIndex = null;

let imagen = "";
let editIndex = null;
let editAlmacenIndex = null;
const usuarioMovimientoFijo = 'Oscar Rosario';

function normalizarNumeroGeografico(value) {
  if (value === '' || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function getAgencyCoordinates(agencia) {
  if (!agencia) return { lat: null, lng: null };
  return {
    lat: normalizarNumeroGeografico(agencia.latitud),
    lng: normalizarNumeroGeografico(agencia.longitud)
  };
}


function formatAgencyOptionLabel(agencia) {
  const numero = String(agencia?.numero ?? '').padStart(4, '0');
  return `Agencia ${numero}`;
}

function getOperationalAgencyOptions() {
  return [...agencias]
    .sort((a, b) => Number(a.numero) - Number(b.numero))
    .map((agencia) => ({
      value: formatAgencyOptionLabel(agencia),
      label: formatAgencyOptionLabel(agencia)
    }));
}

function formatAgencyDisplayValue(value = '') {
  const agencyRecord = findAgencyRecord(value);
  if (agencyRecord) return formatAgencyOptionLabel(agencyRecord);
  const normalizedNumber = normalizeAgencyNumber(value);
  return normalizedNumber ? `Agencia ${normalizedNumber.padStart(4, '0')}` : String(value || '').replace(/\s*,?\s*G-\d{1,2}\b/ig,'').trim();
}

function populateOperationAgencyOptions(selectedValue = '') {
  const input = document.getElementById('operationAgency');
  const datalist = document.getElementById('operationAgencyOptions');
  if (!input || !datalist) return;
  const options = getOperationalAgencyOptions();
  datalist.innerHTML = options.map((option) => `<option value="${option.value}"></option>`).join('');
  input.value = formatAgencyDisplayValue(selectedValue);
}

function populateEditOperationAgencyOptions(selectedValue = '') {
  const input = document.getElementById('editOperationAgency');
  const datalist = document.getElementById('editOperationAgencyOptions');
  if (!input || !datalist) return;
  const options = getOperationalAgencyOptions();
  datalist.innerHTML = options.map((option) => `<option value="${option.value}"></option>`).join('');
  input.value = formatAgencyDisplayValue(selectedValue);
}

function buildAgencyMapsSearchUrl(agencia) {
  const { lat, lng } = getAgencyCoordinates(agencia);
  if (lat !== null && lng !== null) return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  const fallback = encodeURIComponent(String(agencia?.direccion || agencia?.nombre || '').trim());
  return fallback ? `https://www.google.com/maps/search/?api=1&query=${fallback}` : '#';
}

function buildAgencyMapsDirectionsUrl(agencia) {
  const { lat, lng } = getAgencyCoordinates(agencia);
  if (lat !== null && lng !== null) return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
  const fallback = encodeURIComponent(String(agencia?.direccion || agencia?.nombre || '').trim());
  return fallback ? `https://www.google.com/maps/dir/?api=1&destination=${fallback}&travelmode=driving` : '#';
}

function formatAgencyGeoText(agencia) {
  const { lat, lng } = getAgencyCoordinates(agencia);
  if (lat === null || lng === null) return 'Sin coordenadas registradas';
  return `${lat}, ${lng}`;
}


const BUCKET_NAME = 'reportes-operaciones';

function normalizeAgencyNumber(value = '') {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const match = raw.match(/(\d{3,4})/);
  if (!match) return '';
  const numeric = Number(match[1]);
  return Number.isFinite(numeric) ? String(numeric) : String(match[1]).replace(/^0+/, '') || '0';
}

function normalizeAgencyLabel(value = '') {
  const agencyNumber = normalizeAgencyNumber(value);
  return agencyNumber ? `Agencia ${agencyNumber.padStart(4, '0')}` : String(value || '').trim();
}

function findAgencyRecord(value = '') {
  const agencyNumber = normalizeAgencyNumber(value);
  if (!agencyNumber) return null;
  return agencias.find(item => String(Number(item.numero)) === agencyNumber) || null;
}

function enrichOperationWithAgencyContext(op = {}) {
  const sourceValue = op.agency_number || op.agency || op.agencia || op.agencia_display || '';
  const agencyRecord = findAgencyRecord(sourceValue);
  const normalizedNumber = normalizeAgencyNumber(sourceValue);
  const fallbackLabel = normalizeAgencyLabel(sourceValue);
  if (!agencyRecord) {
    return {
      ...op,
      agency_number: normalizedNumber || op.agency_number || '',
      agency_label: fallbackLabel || op.agency_label || op.agency || op.agencia_display || op.agencia || ''
    };
  }
  const agencyLabel = agencyRecord.nombre || fallbackLabel || op.agency || op.agencia || '';
  return {
    ...op,
    agency_number: normalizedNumber || String(Number(agencyRecord.numero)),
    agency_label: agencyLabel,
    agency: agencyLabel,
    grupo: agencyRecord.grupo || op.grupo || '',
    nombre_encargado: op.nombre_encargado || op.created_by || '',
    created_by: op.created_by || op.nombre_encargado || '',
    encargado_agencia: agencyRecord.encargado || op.encargado_agencia || '',
    agency_latitude: normalizarNumeroGeografico(agencyRecord.latitud),
    agency_longitude: normalizarNumeroGeografico(agencyRecord.longitud),
    agency_direccion: agencyRecord.direccion || '',
    agency_maps_url: buildAgencyMapsSearchUrl(agencyRecord),
    agency_directions_url: buildAgencyMapsDirectionsUrl(agencyRecord)
  };
}

function normalizeMediaItems(input) {
  if (!input) return [];
  let items = input;
  if (typeof items === 'string') {
    const trimmed = items.trim();
    if (!trimmed) return [];
    try {
      items = JSON.parse(trimmed);
    } catch (_err) {
      items = trimmed.includes(',') ? trimmed.split(',') : [trimmed];
    }
  }
  if (!Array.isArray(items)) items = [items];
  return items
    .flatMap(item => {
      if (item == null) return [];
      if (typeof item === 'string') return [item];
      if (typeof item === 'object') return [item.publicUrl, item.url, item.path, item.name].filter(Boolean);
      return [String(item)];
    })
    .map(value => String(value || '').trim())
    .filter(Boolean);
}

function resolvearchivosMediaUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^blob:/i.test(raw) || /^data:/i.test(raw) || /^https?:\/\//i.test(raw)) return raw;
  const sanitized = raw.replace(/^\/+/, '');
  const bucketPrefix = `${BUCKET_NAME}/`;
  const filePath = sanitized.startsWith(bucketPrefix)
    ? sanitized.slice(bucketPrefix.length)
    : sanitized.replace(/^reportes-operaciones\//i, '');
  return raw;
}

function getSafeMediaList(items = []) {
  return normalizeMediaItems(items).map(resolvearchivosMediaUrl).filter(Boolean);
}


const suplidoresBase = ['Suplidor General', 'Distribuidora Central', 'Tech Supplies RD', 'Importadora Loteka'];
let entradasInventario = [];
let secuenciaEntrada = 1;
let entradaActualItems = [];
let serialesTemporalesEntrada = [];
let transferenciasInventario = [];
let secuenciaTransferencia = 1;
let transferenciaActualItems = [];
let serialesTemporalesTransferencia = [];
let detalleAlmacenActualIndex = null;
let editAgenciaIndex = null;
let agenciaPendienteSeriales = [];
let agenciaTransferItemId = null;
let grupoPendienteSeriales = [];

function obtenerFechaHoraActual(){
  const ahora = new Date();
  const dd = String(ahora.getDate()).padStart(2, '0');
  const mm = String(ahora.getMonth() + 1).padStart(2, '0');
  const yyyy = ahora.getFullYear();
  const hh = String(ahora.getHours()).padStart(2, '0');
  const min = String(ahora.getMinutes()).padStart(2, '0');
  return {
    fecha: `${dd}-${mm}-${yyyy}`,
    hora: `${hh}:${min}`,
    fechaHora: `${dd}-${mm}-${yyyy} ${hh}:${min}`
  };
}


function obtenerFechaHoraLocalValue(){
  const ahora = new Date();
  const yyyy = ahora.getFullYear();
  const mm = String(ahora.getMonth() + 1).padStart(2, '0');
  const dd = String(ahora.getDate()).padStart(2, '0');
  const hh = String(ahora.getHours()).padStart(2, '0');
  const min = String(ahora.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

function construirFechaHoraDesdeInput(valor){
  if(!valor){
    return obtenerFechaHoraActual();
  }
  const fechaObj = new Date(valor);
  if(isNaN(fechaObj.getTime())){
    return obtenerFechaHoraActual();
  }
  const dd = String(fechaObj.getDate()).padStart(2, '0');
  const mm = String(fechaObj.getMonth() + 1).padStart(2, '0');
  const yyyy = fechaObj.getFullYear();
  const hh = String(fechaObj.getHours()).padStart(2, '0');
  const min = String(fechaObj.getMinutes()).padStart(2, '0');
  return {
    fecha: `${dd}-${mm}-${yyyy}`,
    hora: `${hh}:${min}`,
    fechaHora: `${dd}-${mm}-${yyyy} ${hh}:${min}`,
    fechaISO: `${yyyy}-${mm}-${dd}`
  };
}

function registrarMovimientoAlmacen(almacenIndex, tipo, referencia, detalle, usuario = usuarioMovimientoFijo, tiempoPersonalizado = null, documentoCodigo = ''){
  const almacen = almacenes[almacenIndex];
  if(!almacen) return;
  const tiempo = tiempoPersonalizado || obtenerFechaHoraActual();
  const esTransferencia = String(tipo || '').toLowerCase().includes('transferencia') || String(referencia || '').toUpperCase().startsWith('TR-');
  almacen.movimientos.push({
    fecha: tiempo.fecha,
    hora: tiempo.hora,
    fechaHora: tiempo.fechaHora,
    tipo,
    referencia,
    usuario,
    detalle,
    entradaCodigo: esTransferencia ? '' : documentoCodigo,
    transferenciaCodigo: esTransferencia ? (documentoCodigo || referencia) : ''
  });
}

function cambiarVista(vista, el){
  [
    'vista-home','vista-productos','vista-almacenes','vista-entrada','vista-transferencia','vista-control-despachos','vista-agencias','vista-grupos',
    'vista-taller-v2','vista-dashboard-rrhh','vista-operadoras','vista-solicitudes','vista-historial-rrhh'
  ].forEach(id=>{ const node=document.getElementById(id); if(node) node.classList.add('hidden'); });
  const target = document.getElementById('vista-' + vista);
  if(target) target.classList.remove('hidden');
  activateSidebarLink(el, vista);
  if(vista==='agencias' && typeof renderAgencias === 'function') renderAgencias();
  if(vista==='grupos' && typeof renderGrupos === 'function') renderGrupos();
  if(vista==='control-despachos' && typeof lotekaRenderControlDespachos === 'function') lotekaRenderControlDespachos();  if(vista==='home' && typeof agencyMapRefresh === 'function') setTimeout(() => agencyMapRefresh(agencias), 120);
  if(vista==='dashboard-rrhh' && typeof rrhdRender === 'function') rrhdRender();
  if(vista==='solicitudes' && typeof hrxSyncSolicitudesFromBackendCero === 'function') hrxSyncSolicitudesFromBackendCero(false); else if(vista==='solicitudes' && typeof hrxApplyFilters === 'function') hrxApplyFilters();
  if(vista==='operadoras' && typeof opxApplyFilters === 'function') opxApplyFilters();
  if(vista==='historial-rrhh' && typeof hrhApplyFilters === 'function') hrhApplyFilters();
}

function abrirProducto(){
  editIndex = null;
  document.getElementById('tituloModalProducto').innerText = 'Crear Producto';
  limpiarProducto();
  document.getElementById('modalProducto').style.display = 'flex';
}

function cerrarProducto(){
  document.getElementById('modalProducto').style.display = 'none';
}

function preview(e){
  const file = e.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = function(ev){
    imagen = ev.target.result;
    document.getElementById('preview').innerHTML = `<img src="${imagen}" style="width:100%;height:100%;object-fit:cover">`;
  }
  reader.readAsDataURL(file);
}

function guardarProducto(){
  const data = {
    nombre: document.getElementById('nombre').value,
    marca: document.getElementById('marca').value,
    modelo: document.getElementById('modelo').value,
    precio: document.getElementById('precio').value,
    categoria: document.getElementById('categoria').value,
    imagen
  };

  if(!data.nombre){
    alert('Pon nombre');
    return;
  }

  if(editIndex === null){
    productos.push(data);
  } else {
    productos[editIndex] = data;
  }

  renderProductos();
  cerrarProducto();
  limpiarProducto();
}

function editarProducto(i){
  const p = productos[i];
  document.getElementById('nombre').value = p.nombre;
  document.getElementById('marca').value = p.marca;
  document.getElementById('modelo').value = p.modelo;
  document.getElementById('precio').value = p.precio;
  (function(){
    var catEl = document.getElementById('categoria');
    var rawCat = p.categoria || '';
    if(catEl){
      catEl.value = rawCat;
      if(!catEl.value){
        var low = String(rawCat).toLowerCase();
        if(low.includes('cam')) catEl.value = 'Cámara';
        else if(low.includes('router')) catEl.value = 'Routers';
        else if(low.includes('elect') || low.includes('ups') || low.includes('inversor') || low.includes('bater')) catEl.value = 'Equipos Eléctricos';
        else if(low.includes('insumo') || low.includes('material') || low.includes('consumible')) catEl.value = 'Insumos / Materiales';
        else if(low.includes('adic') || low.includes('otro')) catEl.value = 'Adicional / Otros';
        else if(low.includes('equipo')) catEl.value = 'Equipos';
      }
    }
  })();
  imagen = p.imagen || '';
  document.getElementById('preview').innerHTML = imagen
    ? `<img src="${imagen}" style="width:100%;height:100%;object-fit:cover">`
    : 'Subir imagen';
  editIndex = i;
  document.getElementById('tituloModalProducto').innerText = 'Editar Producto';
  document.getElementById('modalProducto').style.display = 'flex';const tipoProductoEl = document.getElementById('tipoProducto');
if(tipoProductoEl){
  tipoProductoEl.value = lotekaTipoProductoDesdeDato(productos[i]);
}
}

function limpiarProducto(){
  document.getElementById('nombre').value = '';
  document.getElementById('marca').value = '';
  document.getElementById('modelo').value = '';
  document.getElementById('precio').value = '';
  document.getElementById('categoria').value = '';
  const tipoProductoEl = document.getElementById('tipoProducto');
if(tipoProductoEl){
  tipoProductoEl.value = 'EQUIPO';
}
  document.getElementById('archivoImagen').value = '';
  document.getElementById('preview').innerHTML = 'Subir imagen';
  imagen = '';
}


function obtenerReferenciaEntrada(){
  return 'EN-' + String(secuenciaEntrada++).padStart(6, '0');
}


function abrirEntrada(){
  llenarOpcionesModalEntrada();
  entradaActualItems = [];
  serialesTemporalesEntrada = [];
  document.getElementById('entradaAlmacen').value = '';
  document.getElementById('entradaProducto').value = '';
  document.getElementById('entradaUnidades').value = '';
  document.getElementById('entradaSerializado').value = 'no';
  document.getElementById('entradaSuplidor').value = 'Suplidor General';
  document.getElementById('entradaUsuario').value = usuarioMovimientoFijo;
  document.getElementById('entradaFechaRecepcion').value = obtenerFechaHoraLocalValue();
  document.getElementById('entradaReferencia').value = obtenerReferenciaEntrada();
  document.getElementById('entradaObservacion').value = '';
  document.getElementById('entradaSerialInput').value = '';
  actualizarCampoSerialesEntrada();
  renderSerialesEntrada();
  renderItemsEntradaActual();
  document.getElementById('modalEntrada').style.display = 'flex';
}

function cerrarEntrada(){
  document.getElementById('modalEntrada').style.display = 'none';
}

function llenarOpcionesModalEntrada(){
  const selectAlmacen = document.getElementById('entradaAlmacen');
  const selectProducto = document.getElementById('entradaProducto');
  const selectSuplidor = document.getElementById('entradaSuplidor');
  if(selectAlmacen){
    selectAlmacen.innerHTML = '<option value="">Selecciona</option>' + almacenes.map((a, i) => `<option value="${i}">${a.nombre}</option>`).join('');
  }
  if(selectProducto){
    selectProducto.innerHTML = '<option value="">Selecciona</option>' + productos.map((p, i) => `<option value="${i}">${p.nombre}</option>`).join('');
  }
  if(selectSuplidor){
    selectSuplidor.innerHTML = '<option value="">Selecciona</option>' + suplidoresBase.map(s => `<option value="${s}">${s}</option>`).join('');
  }
}

function actualizarCampoSerialesEntrada(){
  const serializado = document.getElementById('entradaSerializado')?.value || 'no';
  const section = document.getElementById('serialSectionEntrada');
  const input = document.getElementById('entradaSerialInput');
  if(serializado === 'si'){
    section.classList.remove('serial-hidden');
    input.disabled = false;
    input.placeholder = 'Escribe un serial';
  } else {
    section.classList.add('serial-hidden');
    serialesTemporalesEntrada = [];
    if(input){
      input.value = '';
      input.disabled = true;
      input.placeholder = 'Disponible solo para productos serializados';
    }
    renderSerialesEntrada();
  }
}

function agregarSerialEntrada(){
  const input = document.getElementById('entradaSerialInput');
  const serial = (input?.value || '').trim();
  if(!serial){
    alert('Escribe un serial');
    return;
  }
  if(serialesTemporalesEntrada.includes(serial)){
    alert('Ese serial ya fue agregado');
    return;
  }
  serialesTemporalesEntrada.push(serial);
  input.value = '';
  renderSerialesEntrada();
  input.focus();
}

function eliminarSerialEntrada(index){
  serialesTemporalesEntrada.splice(index, 1);
  renderSerialesEntrada();
}

function renderSerialesEntrada(){
  const empty = document.getElementById('serialesVaciosEntrada');
  const table = document.getElementById('tablaSerialesEntrada');
  const body = document.getElementById('serialesEntradaBody');
  if(!body) return;
  body.innerHTML = '';
  if(serialesTemporalesEntrada.length === 0){
    empty.style.display = 'block';
    table.style.display = 'none';
    return;
  }
  empty.style.display = 'none';
  table.style.display = 'table';
  serialesTemporalesEntrada.forEach((serial, index) => {
    body.innerHTML += `
      <tr>
        <td>${index + 1}</td>
        <td>${serial}</td>
        <td><button class="entry-remove-btn" type="button" onclick="eliminarSerialEntrada(${index})"><i class="fas fa-times"></i></button></td>
      </tr>
    `;
  });
}

function agregarProductoEntrada(){
  const productoIndex = document.getElementById('entradaProducto').value;
  const unidades = Number(document.getElementById('entradaUnidades').value || 0);
  const serializado = document.getElementById('entradaSerializado').value;
  if(productoIndex === ''){
    alert('Selecciona un producto');
    return;
  }
  if(unidades <= 0){
    alert('Ingresa una cantidad válida');
    return;
  }

  const producto = productos[Number(productoIndex)];
  if(serializado === 'si'){
    if(serialesTemporalesEntrada.length !== unidades){
      alert('La cantidad de seriales debe ser igual a la cantidad indicada');
      return;
    }
  }

  entradaActualItems.push({
    producto: producto.nombre,
    marca: producto.marca,
    modelo: producto.modelo,
    categoria: producto.categoria,
    cantidad: unidades,
    serializado,
    seriales: serializado === 'si' ? [...serialesTemporalesEntrada] : []
  });

  document.getElementById('entradaProducto').value = '';
  document.getElementById('entradaUnidades').value = '';
  document.getElementById('entradaSerializado').value = 'no';
  serialesTemporalesEntrada = [];
  document.getElementById('entradaSerialInput').value = '';
  actualizarCampoSerialesEntrada();
  renderSerialesEntrada();
  renderItemsEntradaActual();
}

function eliminarProductoEntrada(index){
  entradaActualItems.splice(index, 1);
  renderItemsEntradaActual();
}

function renderItemsEntradaActual(){
  const empty = document.getElementById('entradaItemsVacio');
  const table = document.getElementById('entradaItemsTabla');
  const body = document.getElementById('entradaItemsBody');
  if(!body) return;
  body.innerHTML = '';
  if(entradaActualItems.length === 0){
    empty.style.display = 'block';
    table.style.display = 'none';
    return;
  }
  empty.style.display = 'none';
  table.style.display = 'table';
  entradaActualItems.forEach((item, index) => {
    body.innerHTML += `
      <tr>
        <td>${item.producto}</td>
        <td><strong>${item.cantidad}</strong></td>
        <td>${item.serializado === 'si' ? 'Sí' : 'No'}</td>
        <td>${item.serializado === 'si' ? item.seriales.length : '-'}</td>
        <td><button class="entry-remove-btn" type="button" onclick="eliminarProductoEntrada(${index})"><i class="fas fa-trash"></i></button></td>
      </tr>
    `;
  });
}

function guardarEntrada(){
  const almacenIndex = document.getElementById('entradaAlmacen').value;
  const suplidor = document.getElementById('entradaSuplidor').value.trim() || 'Suplidor General';
  const usuario = document.getElementById('entradaUsuario').value || usuarioMovimientoFijo;
  const referencia = document.getElementById('entradaReferencia').value;
  const observacion = document.getElementById('entradaObservacion').value.trim();
  const fechaRecepcionValor = document.getElementById('entradaFechaRecepcion').value;
  const tiempo = construirFechaHoraDesdeInput(fechaRecepcionValor);

  if(almacenIndex === ''){
    alert('Selecciona un almacén');
    return;
  }
  if(!suplidor){
    alert('Selecciona un suplidor');
    return;
  }
  if(!fechaRecepcionValor){
    alert('Selecciona la fecha de recepción');
    return;
  }
  if(entradaActualItems.length === 0){
    alert('Agrega por lo menos un producto a la entrada');
    return;
  }

  const confirmarMovimiento = confirm('¿Estás seguro de realizar este movimiento?');
  if(!confirmarMovimiento){
    return;
  }

  const almacen = almacenes[Number(almacenIndex)];

  entradaActualItems.forEach(item => {
    const tipoItem = item.serializado === 'si' ? 'Serializado' : 'No serializado';
    const inventarioExistente = almacen.inventario.find(inv =>
      inv.producto === item.producto &&
      inv.marca === item.marca &&
      inv.modelo === item.modelo
    );

    if(inventarioExistente){
      inventarioExistente.cantidad = Number(inventarioExistente.cantidad || 0) + Number(item.cantidad || 0);
      inventarioExistente.tipo = tipoItem;
      if(!Array.isArray(inventarioExistente.seriales)) inventarioExistente.seriales = [];
      if(item.serializado === 'si'){
        inventarioExistente.seriales = inventarioExistente.seriales.concat(item.seriales);
      }
    } else {
      almacen.inventario.push({
        producto: item.producto,
        marca: item.marca,
        modelo: item.modelo,
        categoria: item.categoria,
        cantidad: item.cantidad,
        tipo: tipoItem,
        seriales: item.serializado === 'si' ? [...item.seriales] : []
      });
    }
  });

  const totalUnidades = entradaActualItems.reduce((sum, item) => sum + Number(item.cantidad || 0), 0);
  const resumenProductos = entradaActualItems.map(item => `${item.producto} (${item.cantidad})`).join(', ');
  const tieneSerializados = entradaActualItems.some(item => item.serializado === 'si');
  const detalleMovimiento = observacion || resumenProductos;

  registrarMovimientoAlmacen(
    Number(almacenIndex),
    'Entrada',
    referencia,
    detalleMovimiento,
    usuario,
    tiempo,
    referencia
  );

  entradasInventario.unshift({
    codigo: referencia,
    almacen: almacen.nombre,
    producto: entradaActualItems.length === 1 ? entradaActualItems[0].producto : `${entradaActualItems[0].producto} (+${entradaActualItems.length - 1})`,
    productosResumen: resumenProductos,
    unidades: totalUnidades,
    fecha: tiempo.fecha,
    hora: tiempo.hora,
    fechaHora: tiempo.fechaHora,
    fechaVista: tiempo.fechaHora,
    fechaISO: tiempo.fechaISO,
    usuario,
    estado: 'Recibido',
    suplidor,
    serializado: tieneSerializados ? 'si' : 'no',
    observacion,
    items: entradaActualItems.map(item => ({...item}))
  });

  llenarFiltrosEntrada();
  renderEntradas();
  renderAlmacenes();
  cerrarEntrada();
}
function llenarFiltrosEntrada(){
  const selectAlmacen = document.getElementById('filtroEntradaAlmacen');
  const selectProducto = document.getElementById('filtroEntradaProducto');
  const selectSuplidor = document.getElementById('filtroEntradaSuplidor');
  if(selectAlmacen){
    selectAlmacen.innerHTML = '<option value="">Selecciona</option>' + almacenes.map(a => `<option value="${a.nombre}">${a.nombre}</option>`).join('');
  }
  if(selectProducto){
    selectProducto.innerHTML = '<option value="">Selecciona</option>' + productos.map(p => `<option value="${p.nombre}">${p.nombre}</option>`).join('');
  }
  if(selectSuplidor){
    selectSuplidor.innerHTML = '<option value="">Selecciona</option>' + suplidoresBase.map(s => `<option value="${s}">${s}</option>`).join('');
  }
}

function limpiarFiltrosEntrada(){
  ['filtroEntradaAlmacen','filtroEntradaProducto','filtroEntradaDesde','filtroEntradaHasta','filtroEntradaSuplidor','filtroEntradaSerializado','filtroEntradaUsuario','buscarEntrada'].forEach(id=>{
    const el = document.getElementById(id);
    if(el) el.value = '';
  });
  const serial = document.getElementById('filtroEntradaSerializado');
  if(serial) serial.value = 'todos';
  renderEntradas();
}

function aplicarFiltrosEntrada(){
  renderEntradas();
}

function actualizarDashboardEntradas(){
  const hoy = obtenerFechaHoy();
  const totalEntradas = entradasInventario.length;
  const entradasHoy = entradasInventario.filter(e => e.fecha === hoy);
  const unidadesHoy = entradasHoy.reduce((sum, item) => sum + (Number(item.unidades) || 0), 0);
  const totalEl = document.getElementById('dashTotalEntradas');
  const hoyEl = document.getElementById('dashEntradasHoy');
  const uniEl = document.getElementById('dashUnidadesEntradasHoy');
  if(totalEl) totalEl.innerText = totalEntradas;
  if(hoyEl) hoyEl.innerText = entradasHoy.length;
  if(uniEl) uniEl.innerText = unidadesHoy;
}


function renderEntradas(){
  const tbody = document.getElementById('tabla-entradas');
  if(!tbody) return;

  const almacen = (document.getElementById('filtroEntradaAlmacen')?.value || '').toLowerCase();
  const producto = (document.getElementById('filtroEntradaProducto')?.value || '').toLowerCase();
  const desde = document.getElementById('filtroEntradaDesde')?.value || '';
  const hasta = document.getElementById('filtroEntradaHasta')?.value || '';
  const suplidor = (document.getElementById('filtroEntradaSuplidor')?.value || '').toLowerCase();
  const serializado = (document.getElementById('filtroEntradaSerializado')?.value || 'todos').toLowerCase();
  const usuario = (document.getElementById('filtroEntradaUsuario')?.value || '').toLowerCase();
  const buscar = (document.getElementById('buscarEntrada')?.value || '').toLowerCase();

  let filtradas = entradasInventario.filter(item => {
    const textoProductos = (item.productosResumen || item.producto || '').toLowerCase();
    const coincideAlmacen = !almacen || item.almacen.toLowerCase().includes(almacen);
    const coincideProducto = !producto || textoProductos.includes(producto);
    const coincideSuplidor = !suplidor || (item.suplidor || '').toLowerCase().includes(suplidor);
    const coincideSerializado = serializado === 'todos' || !serializado || ((item.serializado || 'no').toLowerCase() === serializado);
    const coincideUsuario = !usuario || item.usuario.toLowerCase().includes(usuario);
    const coincideBuscar = !buscar || [item.codigo, item.almacen, textoProductos, item.usuario, item.estado].join(' ').toLowerCase().includes(buscar);

    let coincideDesde = true;
    let coincideHasta = true;
    if(desde && item.fechaISO) coincideDesde = item.fechaISO >= desde;
    if(hasta && item.fechaISO) coincideHasta = item.fechaISO <= hasta;

    return coincideAlmacen && coincideProducto && coincideSuplidor && coincideSerializado && coincideUsuario && coincideBuscar && coincideDesde && coincideHasta;
  });

  if(filtradas.length === 0){
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="entry-empty">No hay entradas de inventario registradas todavía.</td>
      </tr>
    `;
  } else {
    tbody.innerHTML = '';
    filtradas.forEach(item => {
      tbody.innerHTML += `
        <tr>
          <td><strong>${item.codigo}</strong></td>
          <td>${item.almacen}</td>
          <td title="${item.productosResumen || item.producto}">${item.producto}</td>
          <td><strong>${item.unidades}</strong></td>
          <td>${item.fechaHora || item.fechaVista || item.fecha}</td>
          <td>${item.usuario}</td>
          <td><span class="status-badge">${item.estado}</span></td>
          <td class="actions"><i class="fas fa-eye" title="Ver entrada" onclick="verDetalleEntrada('${item.codigo}')"></i></td>
        </tr>
      `;
    });
  }

  actualizarDashboardEntradas();
}

function renderProductos(){
  const tbody = document.getElementById('tabla-productos');
  tbody.innerHTML = '';

  productos.forEach((p, i) => {
    tbody.innerHTML += `
      <tr>
        <td>${p.imagen ? `<img class="product-thumb" src="${p.imagen}">` : '-'}</td>
        <td>${p.nombre}</td>
        <td>${p.marca}</td>
        <td>${p.modelo}</td>
        <td>${p.precio}</td>
        <td>${p.categoria}</td>
        <td class="actions"><i class="fas fa-edit" onclick="editarProducto(${i})"></i></td>
      </tr>
    `;
  });
}


function abrirAlmacen(){
  editAlmacenIndex = null;
  document.getElementById('tituloModalAlmacen').innerText = 'Crear Almacén';
  limpiarAlmacen();
  document.getElementById('modalAlmacen').style.display = 'flex';
}

function cerrarAlmacen(){
  document.getElementById('modalAlmacen').style.display = 'none';
}

function guardarAlmacen(){
  const data = {
    nombre: document.getElementById('nombreAlmacen').value,
    ubicacion: document.getElementById('ubicacionAlmacen').value,
    descripcion: document.getElementById('descripcionAlmacen').value,
    stats:{productos:0, unidades:"0", ultimo:"Sin movimientos"},
    inventario:[],
    movimientos:[]
  };

  if(!data.nombre){
    alert('Pon nombre');
    return;
  }

  if(editAlmacenIndex === null){
    almacenes.push(data);
  } else {
    const actual = almacenes[editAlmacenIndex];
    almacenes[editAlmacenIndex] = {
      ...actual,
      nombre: data.nombre,
      ubicacion: data.ubicacion,
      descripcion: data.descripcion
    };
  }

  renderAlmacenes();
  cerrarAlmacen();
  limpiarAlmacen();
}

function editarAlmacen(i){
  const a = almacenes[i];
  document.getElementById('nombreAlmacen').value = a.nombre;
  document.getElementById('ubicacionAlmacen').value = a.ubicacion;
  document.getElementById('descripcionAlmacen').value = a.descripcion;
  editAlmacenIndex = i;
  document.getElementById('tituloModalAlmacen').innerText = 'Editar Almacén';
  document.getElementById('modalAlmacen').style.display = 'flex';
}

function limpiarAlmacen(){
  document.getElementById('nombreAlmacen').value = '';
  document.getElementById('ubicacionAlmacen').value = '';
  document.getElementById('descripcionAlmacen').value = '';
}

function obtenerFechaHoy(){
  const hoy = new Date();
  const dd = String(hoy.getDate()).padStart(2, '0');
  const mm = String(hoy.getMonth() + 1).padStart(2, '0');
  const yyyy = hoy.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

function actualizarDashboardAlmacenes(){
  const totalAlmacenes = almacenes.length;
  const totalProductosEnAlmacenes = almacenes.reduce((acc, almacen) => {
    return acc + almacen.inventario.reduce((sub, item) => sub + (Number(item.cantidad) || 0), 0);
  }, 0);
  const hoy = obtenerFechaHoy();
  const movimientosHoy = almacenes.reduce((acc, almacen) => {
    return acc + almacen.movimientos.filter(m => m.fecha === hoy).length;
  }, 0);

  document.getElementById('dashTotalAlmacenes').innerText = totalAlmacenes;
  document.getElementById('dashProductosAlmacenes').innerText = totalProductosEnAlmacenes;
  document.getElementById('dashMovimientosHoy').innerText = movimientosHoy;
}
function lotekaTipoInventario(item){
  if(!item) return 'No serializado';

  const tipoDirecto = String(item.tipo || '').trim();
  if(tipoDirecto && tipoDirecto.toLowerCase() !== 'undefined' && tipoDirecto.toLowerCase() !== 'null'){
    if(tipoDirecto.toLowerCase().includes('serial')) return 'Serializado';
    if(tipoDirecto.toLowerCase().includes('no serial')) return 'No serializado';
    return tipoDirecto;
  }

  const serializado = String(item.serializado || '').trim().toLowerCase();
  if(serializado === 'si' || serializado === 'sí' || serializado === 'true') return 'Serializado';
  if(serializado === 'no' || serializado === 'false') return 'No serializado';

  if(item.requiere_serial === true || item.requiereSerial === true) return 'Serializado';
  if(item.requiere_serial === false || item.requiereSerial === false) return 'No serializado';

  if(item.serial || (Array.isArray(item.seriales) && item.seriales.length > 0)) return 'Serializado';

  return 'No serializado';
}
function renderAlmacenes(){
  const tbody = document.getElementById('tabla-almacenes');
  tbody.innerHTML = '';

  almacenes.forEach((a, i) => {
    const codigoAlmacen = String(a && a.codigo ? a.codigo : '').trim().toUpperCase();
const nombreAlmacen = String(a && a.nombre ? a.nombre : '').trim().toUpperCase();

if(
  !a ||
  a.activo === false ||
  codigoAlmacen === 'ALM-TEST' ||
  nombreAlmacen === 'ALM-TEST'
){
  return;
}
    const totalProductos = a.inventario.length;
    const totalUnidades = a.inventario.reduce((sum, item) => sum + (Number(item.cantidad) || 0), 0);
    const ultimoMov = a.movimientos.length ? a.movimientos[a.movimientos.length - 1] : null;
    const ultimoMovimiento = ultimoMov ? (ultimoMov.fechaHora || `${ultimoMov.fecha} ${ultimoMov.hora || ''}`.trim()) : 'Sin movimientos';
    const tipo = a.tipo || 'Físico';

    a.stats = {
      productos: totalProductos,
      unidades: totalUnidades,
      ultimo: ultimoMovimiento
    };

    tbody.innerHTML += `
      <tr>
        <td>${a.nombre}</td>
        <td>${tipo}</td>
        <td>${totalProductos}</td>
        <td>${totalUnidades}</td>
        <td>${ultimoMovimiento}</td>
        <td class="actions"><i class="fas fa-eye" onclick="verDetalleAlmacen(${i})"></i><i class="fas fa-edit" onclick="editarAlmacen(${i})"></i></td>
      </tr>
    `;
  });

  actualizarDashboardAlmacenes();
}

function verDetalleAlmacen(i){
  detalleAlmacenActualIndex = i;
  const a = almacenes[i];
  document.getElementById('detalleNombre').innerText = '· ' + a.nombre;
  document.getElementById('detalleSubtitulo').innerText = `${a.descripcion} · ${a.ubicacion}`;
  document.getElementById('detalleStats').innerHTML = `-Productos: ${a.stats.productos}<br>-Unidades: ${a.stats.unidades}<br>-Último movimiento:<br>${a.stats.ultimo}`;

  const invBody = document.getElementById('detalleInventarioBody');
  invBody.innerHTML = '';
  if(a.inventario.length === 0){
    invBody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align:center;color:#8a8a8a;font-style:italic;font-weight:700;padding:24px">
          Este almacén no tiene productos agregados todavía.
        </td>
      </tr>
    `;
  } else {
    const inventarioOrdenado = Array.isArray(a.inventario)
  ? [...a.inventario].sort((x, y) => {
      const tx = (typeof lotekaTipoProductoDesdeDato === 'function')
        ? lotekaTipoProductoDesdeDato(x)
        : 'EQUIPO';

      const ty = (typeof lotekaTipoProductoDesdeDato === 'function')
        ? lotekaTipoProductoDesdeDato(y)
        : 'EQUIPO';

      if(tx !== ty) return tx === 'EQUIPO' ? -1 : 1;

      return String(
        x.producto || x.nombre || x.codigo || ''
      ).localeCompare(
        String(y.producto || y.nombre || y.codigo || ''),
        'es'
      );
    })
  : [];

let grupoActualInventario = '';
    inventarioOrdenado.forEach((item, itemIndex) => {
      const grupoItem = (typeof lotekaTipoProductoDesdeDato === 'function')
  ? lotekaTipoProductoDesdeDato(item)
  : 'EQUIPO';
if(grupoItem !== grupoActualInventario){
  grupoActualInventario = grupoItem;
  invBody.innerHTML += `
    <tr>
      <td colspan="7" style="background:#eef7fb;color:#0b4f71;font-weight:900;text-transform:uppercase;letter-spacing:.5px">
        ${grupoItem === 'EQUIPO' ? 'Equipos' : 'Piezas'}
      </td>
    </tr>
  `;
}
      invBody.innerHTML += `
        <tr>
          <td>${item.producto || item.nombre || item.codigo || 'Producto sin nombre'}</td>
          <td>${item.marca}</td>
          <td>${item.modelo}</td>
          <td>${item.categoria}</td>
          <td>${item.cantidad}</td>
          <td>${lotekaTipoInventario(item)}</td>
          <td class="actions"><i class="fas fa-eye" title="Ver producto" onclick="verDetalleProductoAlmacen(${i}, ${itemIndex})"></i></td>
        </tr>
      `;
    });
  }

  const movBody = document.getElementById('detalleMovimientosBody');
  movBody.innerHTML = '';
  if(a.movimientos.length === 0){
    movBody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align:center;color:#8a8a8a;font-style:italic;font-weight:700;padding:24px">
          Este almacén no tiene movimientos registrados.
        </td>
      </tr>
    `;
  } else {
    a.movimientos.forEach(item => {
      const esTransferencia = String(item.tipo || '').toLowerCase().includes('transferencia') || String(item.referencia || '').toUpperCase().startsWith('TR-');
      const codigoMovimiento = item.transferenciaCodigo || item.entradaCodigo || item.referencia || '';
      const botonAccion = esTransferencia
        ? `<i class="fas fa-eye" title="Ver transferencia" onclick="verDetalleTransferencia('${codigoMovimiento}')"></i>`
        : codigoMovimiento
          ? `<i class="fas fa-eye" title="Ver entrada" onclick="verDetalleEntrada('${codigoMovimiento}')"></i>`
          : '-';
      movBody.innerHTML += `
        <tr>
          <td>${item.fechaHora || `${item.fecha} ${item.hora || ''}`.trim()}</td>
          <td>${item.tipo}</td>
          <td>${item.referencia}</td>
          <td>${item.usuario}</td>
          <td>${item.detalle}</td>
          <td class="actions">${botonAccion}</td>
        </tr>
      `;
    });
  }

  cambiarTabDetalle('inventario');
  document.getElementById('modalDetalleAlmacen').style.display = 'flex';
}

function cerrarDetalleAlmacen(){
  document.getElementById('modalDetalleAlmacen').style.display = 'none';
}

function verDetalleProductoAlmacen(almacenIndex, itemIndex){
  const almacen = almacenes[almacenIndex];
  if(!almacen || !almacen.inventario[itemIndex]) return;

  const item = almacen.inventario[itemIndex];
  const productoBase = productos.find(p => p.nombre === item.producto && p.marca === item.marca && p.modelo === item.modelo) ||
                      productos.find(p => p.nombre === item.producto) || {};

  const imagenProducto = productoBase.imagen || 'https://cdn-icons-png.flaticon.com/512/679/679821.png';
  document.getElementById('detalleProductoImagen').src = imagenProducto;
  document.getElementById('detalleProductoNombre').innerText = item.producto;
  document.getElementById('detalleProductoMeta').innerText = `${item.marca} · ${item.modelo} · ${almacen.nombre}`;
  document.getElementById('detalleProductoResumen').innerHTML = `-Categoría: ${item.categoria}<br>-Cantidad: ${item.cantidad}<br>-Tipo: ${lotekaTipoInventario(item)}`;

  const seriales = Array.isArray(item.seriales) ? item.seriales : [];
  const tabla = document.getElementById('detalleProductoSerialesTabla');
  const body = document.getElementById('detalleProductoSerialesBody');
  const vacio = document.getElementById('detalleProductoSerialesVacio');
  body.innerHTML = '';

  if(seriales.length === 0){
    tabla.style.display = 'none';
    vacio.style.display = 'block';
  } else {
    seriales.forEach((serial, index) => {
      body.innerHTML += `
        <tr>
          <td>${index + 1}</td>
          <td>${serial}</td>
        </tr>
      `;
    });
    vacio.style.display = 'none';
    tabla.style.display = 'table';
  }

  document.getElementById('modalDetalleProductoAlmacen').style.display = 'flex';
}

function cerrarDetalleProductoAlmacen(){
  document.getElementById('modalDetalleProductoAlmacen').style.display = 'none';
}
function verDetalleEntrada(codigo){
  const entrada = entradasInventario.find(item => item.codigo === codigo);
  if(!entrada){
    alert('No se encontró el detalle de esta entrada');
    return;
  }

  document.getElementById('detalleEntradaTitulo').innerText = 'Detalle de Entrada de Inventario';
  document.getElementById('detalleEntradaCodigo').innerText = entrada.codigo;
  document.getElementById('detalleEntradaMeta').innerText = `${entrada.almacen} · ${entrada.fechaHora || entrada.fecha} · ${entrada.usuario}`;
  document.getElementById('detalleEntradaResumen').innerHTML = `
    -Suplidor: ${entrada.suplidor || 'N/D'}<br>
    -Productos: ${entrada.items.length}<br>
    -Unidades: ${entrada.unidades}<br>
    -Observación: ${entrada.observacion || 'Sin comentario'}
  `;

  const body = document.getElementById('detalleEntradaItemsBody');
  body.innerHTML = '';
  entrada.items.forEach((item, index) => {
    const serialesTexto = item.serializado === 'si'
      ? (item.seriales && item.seriales.length ? item.seriales.join('<br>') : 'Sin seriales')
      : 'No aplica';
    body.innerHTML += `
      <tr>
        <td>${item.producto}</td>
        <td>${item.marca}</td>
        <td>${item.modelo}</td>
        <td>${item.categoria}</td>
        <td>${item.cantidad}</td>
        <td>${item.serializado === 'si' ? 'Serializado' : 'No serializado'}</td>
        <td>${serialesTexto}</td>
      </tr>
    `;
  });

  document.getElementById('modalDetalleEntrada').style.display = 'flex';
}

function cerrarDetalleEntrada(){
  document.getElementById('modalDetalleEntrada').style.display = 'none';
}


function cambiarTabDetalle(tab){
  const inventario = document.getElementById('tabInventario');
  const movimientos = document.getElementById('tabMovimientos');
  const btnInv = document.getElementById('btnTabInventario');
  const btnMov = document.getElementById('btnTabMovimientos');

  inventario.classList.add('hidden');
  movimientos.classList.add('hidden');
  btnInv.classList.add('inactive');
  btnMov.classList.add('inactive');

  if(tab === 'inventario'){
    inventario.classList.remove('hidden');
    btnInv.classList.remove('inactive');
  } else {
    movimientos.classList.remove('hidden');
    btnMov.classList.remove('inactive');
  }
}


function generarCodigoTransferencia(){
  const codigo = `TR-${String(secuenciaTransferencia).padStart(6, '0')}`;
  secuenciaTransferencia += 1;
  return codigo;
}



function obtenerOpcionesEntidadTransferencia(tipo){
  if(tipo === 'almacen'){
    return '<option value="">Selecciona</option>' + almacenes.map((a, i) => `<option value="almacen-${i}">${a.nombre}</option>`).join('');
  }
  if(tipo === 'agencia'){
    return '<option value="">Selecciona</option>' + agencias.map((a, i) => `<option value="agencia-${i}">${a.nombre}</option>`).join('');
  }
  if(tipo === 'grupo'){
    return '<option value="">Selecciona</option>' + grupos.map((g, i) => `<option value="grupo-${i}">${g.nombre}</option>`).join('');
  }
  return '<option value="">Selecciona</option>';
}

function nombreTipoEntidad(tipo){
  if(tipo === 'almacen') return 'Almacén';
  if(tipo === 'agencia') return 'Agencia';
  if(tipo === 'grupo') return 'Grupo';
  return 'Entidad';
}

function actualizarSelectoresTransferencia(){
  const tipoOrigen = document.getElementById('transferenciaTipoOrigen')?.value || 'almacen';
  const tipoDestino = document.getElementById('transferenciaTipoDestino')?.value || 'almacen';
  const origen = document.getElementById('transferenciaOrigen');
  const destino = document.getElementById('transferenciaDestino');
  const labelOrigen = document.getElementById('labelTransferenciaOrigen');
  const labelDestino = document.getElementById('labelTransferenciaDestino');

  if(labelOrigen) labelOrigen.innerText = `${nombreTipoEntidad(tipoOrigen)} origen`;
  if(labelDestino) labelDestino.innerText = `${nombreTipoEntidad(tipoDestino)} destino`;

  if(origen) origen.innerHTML = obtenerOpcionesEntidadTransferencia(tipoOrigen);
  if(destino) destino.innerHTML = obtenerOpcionesEntidadTransferencia(tipoDestino);

  actualizarProductosTransferenciaSegunOrigen();
}

function llenarSelectsTransferencia(){
  const filtroOrigen = document.getElementById('filtroTransferenciaOrigen');
  const filtroDestino = document.getElementById('filtroTransferenciaDestino');
  const filtroProducto = document.getElementById('filtroTransferenciaProducto');

  if(filtroOrigen) filtroOrigen.innerHTML = '<option value="">Selecciona</option>' + [
    ...almacenes.map(a => `<option value="${a.nombre}">${a.nombre}</option>`),
    ...agencias.map(a => `<option value="${a.nombre}">${a.nombre}</option>`),
    ...grupos.map(g => `<option value="${g.nombre}">${g.nombre}</option>`)
  ].join('');
  if(filtroDestino) filtroDestino.innerHTML = '<option value="">Selecciona</option>' + [
    ...almacenes.map(a => `<option value="${a.nombre}">${a.nombre}</option>`),
    ...agencias.map(a => `<option value="${a.nombre}">${a.nombre}</option>`),
    ...grupos.map(g => `<option value="${g.nombre}">${g.nombre}</option>`)
  ].join('');
  if(filtroProducto) filtroProducto.innerHTML = '<option value="">Selecciona</option>' + productos.map(p => `<option value="${p.nombre}">${p.nombre}</option>`).join('');
  actualizarSelectoresTransferencia();
}

function obtenerInventarioTransferible(tipo, index){
  if(tipo === 'almacen') return almacenes[index]?.inventario || [];
  if(tipo === 'grupo') return grupos[index]?.custodia || [];
  if(tipo === 'agencia') return agencias[index]?.equipos || [];
  return [];
}

function actualizarProductosTransferenciaSegunOrigen(){
  const origenValue = document.getElementById('transferenciaOrigen').value;
  const selectProducto = document.getElementById('transferenciaProducto');
  if(!selectProducto) return;
  if(origenValue === ''){
    selectProducto.innerHTML = '<option value="">Selecciona</option>';
    return;
  }

  const [tipoOrigen, indexStr] = origenValue.split('-');
  const index = Number(indexStr);
  const inventario = obtenerInventarioTransferible(tipoOrigen, index);

  if(inventario.length === 0){
    selectProducto.innerHTML = '<option value="">Sin productos disponibles</option>';
    return;
  }

  selectProducto.innerHTML = '<option value="">Selecciona</option>' + inventario.map((item, idx) => {
    const cantidad = item.cantidad ?? 1;
    const serialTxt = item.serial ? ` · ${item.serial}` : '';
    return `<option value="${idx}">${item.producto} · ${item.marca} · ${item.modelo}${serialTxt} (${cantidad})</option>`;
  }).join('');
}

function abrirTransferencia(){
  document.getElementById('tituloModalTransferencia').innerText = 'Crear Transferencia';
  document.getElementById('transferenciaTipoOrigen').value = 'almacen';
  document.getElementById('transferenciaTipoDestino').value = 'almacen';
  document.getElementById('transferenciaFecha').value = obtenerFechaHoraLocalValue();
  document.getElementById('transferenciaObservacion').value = '';
  document.getElementById('transferenciaUsuario').value = usuarioMovimientoFijo;
  document.getElementById('transferenciaReferencia').value = generarCodigoTransferencia();
  document.getElementById('transferenciaUnidades').value = '';
  document.getElementById('transferenciaSerializado').value = 'no';
  document.getElementById('transferenciaSerialInput').value = '';
  transferenciaActualItems = [];
  serialesTemporalesTransferencia = [];
  actualizarCampoSerialesTransferencia();
  renderSerialesTransferencia();
  renderItemsTransferenciaActual();
  actualizarSelectoresTransferencia();
  document.getElementById('transferenciaOrigen').value = '';
  document.getElementById('transferenciaDestino').value = '';
  actualizarProductosTransferenciaSegunOrigen();
  document.getElementById('modalTransferencia').style.display = 'flex';
}

function cerrarTransferencia(){
  document.getElementById('modalTransferencia').style.display = 'none';
}

function actualizarCampoSerialesTransferencia(){
  const select = document.getElementById('transferenciaSerializado').value;
  const section = document.getElementById('serialSectionTransferencia');
  if(select === 'si'){
    section.classList.remove('serial-hidden');
  } else {
    section.classList.add('serial-hidden');
    serialesTemporalesTransferencia = [];
    document.getElementById('transferenciaSerialInput').value = '';
    renderSerialesTransferencia();
  }
}

function agregarSerialTransferencia(){
  const input = document.getElementById('transferenciaSerialInput');
  const serial = input.value.trim();
  if(!serial){
    alert('Escribe un serial');
    return;
  }
  if(serialesTemporalesTransferencia.includes(serial)){
    alert('Ese serial ya fue agregado');
    return;
  }
  serialesTemporalesTransferencia.push(serial);
  input.value = '';
  renderSerialesTransferencia();
}

function eliminarSerialTransferencia(index){
  serialesTemporalesTransferencia.splice(index, 1);
  renderSerialesTransferencia();
}

function renderSerialesTransferencia(){
  const empty = document.getElementById('serialesVaciosTransferencia');
  const table = document.getElementById('tablaSerialesTransferencia');
  const body = document.getElementById('serialesTransferenciaBody');
  if(!body) return;
  body.innerHTML = '';
  if(serialesTemporalesTransferencia.length === 0){
    empty.style.display = 'block';
    table.style.display = 'none';
    return;
  }
  empty.style.display = 'none';
  table.style.display = 'table';
  serialesTemporalesTransferencia.forEach((serial, index) => {
    body.innerHTML += `
      <tr>
        <td>${index + 1}</td>
        <td>${serial}</td>
        <td><button class="entry-remove-btn" type="button" onclick="eliminarSerialTransferencia(${index})"><i class="fas fa-trash"></i></button></td>
      </tr>
    `;
  });
}


function agregarProductoTransferencia(){
  const origenValue = document.getElementById('transferenciaOrigen').value;
  const inventarioIndex = document.getElementById('transferenciaProducto').value;
  const unidades = Number(document.getElementById('transferenciaUnidades').value);
  const serializado = document.getElementById('transferenciaSerializado').value;

  if(origenValue === ''){
    alert('Selecciona el origen');
    return;
  }
  if(inventarioIndex === ''){
    alert('Selecciona un producto');
    return;
  }
  if(unidades <= 0){
    alert('Ingresa una cantidad válida');
    return;
  }

  const [tipoOrigen, indexStr] = origenValue.split('-');
  const origenIndex = Number(indexStr);

  let origenRegistro = null;
  if(tipoOrigen === 'almacen'){
    origenRegistro = (almacenes[origenIndex]?.inventario || [])[Number(inventarioIndex)];
  } else if(tipoOrigen === 'grupo'){
    origenRegistro = (grupos[origenIndex]?.custodia || [])[Number(inventarioIndex)];
  } else if(tipoOrigen === 'agencia'){
    origenRegistro = (agencias[origenIndex]?.equipos || [])[Number(inventarioIndex)];
  }

  if(!origenRegistro){
    alert('No se encontró el producto en el origen seleccionado');
    return;
  }

  const cantidadDisponible = Number(origenRegistro.cantidad ?? 1);
  if(cantidadDisponible < unidades){
    alert('La cantidad supera la existencia disponible en el origen');
    return;
  }

  const esSerializadoOrigen = Boolean(origenRegistro.serial) || ((origenRegistro.tipo || '').toLowerCase().includes('serial'));
  if(serializado === 'si'){
    if(serialesTemporalesTransferencia.length !== unidades){
      alert('La cantidad de seriales debe ser igual a la cantidad indicada');
      return;
    }
    const serialesOrigen = origenRegistro.serial ? [origenRegistro.serial] : (Array.isArray(origenRegistro.seriales) ? origenRegistro.seriales : []);
    const faltantes = serialesTemporalesTransferencia.filter(s => !serialesOrigen.includes(s));
    if(!esSerializadoOrigen || faltantes.length > 0){
      alert('Hay seriales que no existen en el origen seleccionado');
      return;
    }
  }

  transferenciaActualItems.push({
    producto: origenRegistro.producto,
    marca: origenRegistro.marca,
    modelo: origenRegistro.modelo,
    categoria: origenRegistro.categoria,
    cantidad: unidades,
    serializado,
    seriales: serializado === 'si' ? [...serialesTemporalesTransferencia] : [],
    imagen: origenRegistro.imagen || '',
    tipoOrigen,
    origenIndex
  });

  document.getElementById('transferenciaProducto').value = '';
  document.getElementById('transferenciaUnidades').value = '';
  document.getElementById('transferenciaSerializado').value = 'no';
  document.getElementById('transferenciaSerialInput').value = '';
  serialesTemporalesTransferencia = [];
  actualizarCampoSerialesTransferencia();
  renderSerialesTransferencia();
  renderItemsTransferenciaActual();
}

function eliminarProductoTransferencia(index){
  transferenciaActualItems.splice(index, 1);
  renderItemsTransferenciaActual();
}

function renderItemsTransferenciaActual(){
  const empty = document.getElementById('transferenciaItemsVacio');
  const table = document.getElementById('transferenciaItemsTabla');
  const body = document.getElementById('transferenciaItemsBody');
  if(!body) return;
  body.innerHTML = '';
  if(transferenciaActualItems.length === 0){
    empty.style.display = 'block';
    table.style.display = 'none';
    return;
  }
  empty.style.display = 'none';
  table.style.display = 'table';
  transferenciaActualItems.forEach((item, index) => {
    body.innerHTML += `
      <tr>
        <td>${item.producto}</td>
        <td><strong>${item.cantidad}</strong></td>
        <td>${item.serializado === 'si' ? 'Sí' : 'No'}</td>
        <td>${item.serializado === 'si' ? item.seriales.length : '-'}</td>
        <td><button class="entry-remove-btn" type="button" onclick="eliminarProductoTransferencia(${index})"><i class="fas fa-trash"></i></button></td>
      </tr>
    `;
  });
}



function guardarTransferencia(){
  const tipoOrigenSeleccion = document.getElementById('transferenciaTipoOrigen').value || 'almacen';
  const tipoDestinoSeleccion = document.getElementById('transferenciaTipoDestino').value || 'almacen';
  const origenValue = document.getElementById('transferenciaOrigen').value;
  const destinoValue = document.getElementById('transferenciaDestino').value;
  const usuario = document.getElementById('transferenciaUsuario').value || usuarioMovimientoFijo;
  const referencia = document.getElementById('transferenciaReferencia').value;
  const observacion = document.getElementById('transferenciaObservacion').value.trim();
  const fechaValor = document.getElementById('transferenciaFecha').value;
  const tiempo = construirFechaHoraDesdeInput(fechaValor);

  if(origenValue === ''){
    alert('Selecciona el origen');
    return;
  }
  if(destinoValue === ''){
    alert('Selecciona el destino');
    return;
  }
  if(origenValue === destinoValue){
    alert('El origen y el destino no pueden ser el mismo');
    return;
  }
  if(!fechaValor){
    alert('Selecciona la fecha de transferencia');
    return;
  }
  if(transferenciaActualItems.length === 0){
    alert('Agrega por lo menos un producto a la transferencia');
    return;
  }

  const confirmarMovimiento = confirm('¿Estás seguro de realizar este movimiento?');
  if(!confirmarMovimiento){
    return;
  }

  const [origenTipo, origenIndexStr] = origenValue.split('-');
  const [destinoTipo, destinoIndexStr] = destinoValue.split('-');
  const origenIndex = Number(origenIndexStr);
  const destinoIndex = Number(destinoIndexStr);

  const getCollection = (tipo, index) => {
    if(tipo === 'almacen') return almacenes[index].inventario;
    if(tipo === 'grupo') return grupos[index].custodia;
    if(tipo === 'agencia') return agencias[index].equipos;
    return [];
  };
  const getNombre = (tipo, index) => {
    if(tipo === 'almacen') return almacenes[index].nombre;
    if(tipo === 'grupo') return grupos[index].nombre;
    if(tipo === 'agencia') return agencias[index].nombre;
    return '';
  };

  const origenInventario = getCollection(origenTipo, origenIndex);
  const destinoInventario = getCollection(destinoTipo, destinoIndex);

  for(const item of transferenciaActualItems){
    const existente = origenInventario.find(inv =>
      inv.producto === item.producto &&
      inv.marca === item.marca &&
      inv.modelo === item.modelo
    );
    if(!existente){
      alert(`El producto ${item.producto} ya no existe en el origen.`);
      return;
    }

    const cantidadExistente = Number(existente.cantidad ?? 1);
    if(cantidadExistente < Number(item.cantidad || 0)){
      alert(`No hay cantidad suficiente de ${item.producto} en el origen.`);
      return;
    }

    if(item.serializado === 'si'){
      const serialesOrigen = existente.serial ? [existente.serial] : (Array.isArray(existente.seriales) ? existente.seriales : []);
      const faltantes = item.seriales.filter(s => !serialesOrigen.includes(s));
      if(faltantes.length > 0){
        alert(`Faltan seriales de ${item.producto} en el origen.`);
        return;
      }
    }
  }

  for(const item of transferenciaActualItems){
    const existente = origenInventario.find(inv =>
      inv.producto === item.producto &&
      inv.marca === item.marca &&
      inv.modelo === item.modelo
    );

    if(item.serializado === 'si'){
      const serialesOrigen = existente.serial ? [existente.serial] : (Array.isArray(existente.seriales) ? existente.seriales : []);
      const nuevosSerialesOrigen = serialesOrigen.filter(s => !item.seriales.includes(s));

      if(existente.serial){
        const seVa = item.seriales.includes(existente.serial);
        if(seVa){
          const idx = origenInventario.indexOf(existente);
          if(idx > -1) origenInventario.splice(idx, 1);
        }
      } else {
        existente.seriales = nuevosSerialesOrigen;
        existente.cantidad = Number(existente.cantidad || 0) - Number(item.cantidad || 0);
        if(existente.cantidad <= 0){
          const idx = origenInventario.indexOf(existente);
          if(idx > -1) origenInventario.splice(idx, 1);
        }
      }
    } else {
      existente.cantidad = Number(existente.cantidad ?? 1) - Number(item.cantidad || 0);
      if(existente.cantidad <= 0){
        const idx = origenInventario.indexOf(existente);
        if(idx > -1) origenInventario.splice(idx, 1);
      }
    }

    if(item.serializado === 'si'){
      item.seriales.forEach(serial => {
        const registroSerial = {
          producto:item.producto,
          marca:item.marca,
          modelo:item.modelo,
          categoria:item.categoria,
          imagen:item.imagen || '',
          serial,
          fechaInstalacion:tiempo.fecha,
          cantidad:1,
          tipo:'Serializado',
          id:`${referencia}-${serial}`
        };
        destinoInventario.push(registroSerial);
      });
    } else {
      const existenteDestino = destinoInventario.find(inv =>
        inv.producto === item.producto &&
        inv.marca === item.marca &&
        inv.modelo === item.modelo &&
        !inv.serial
      );
      if(existenteDestino){
        existenteDestino.cantidad = Number(existenteDestino.cantidad ?? 0) + Number(item.cantidad || 0);
      }else{
        destinoInventario.push({
          producto:item.producto,
          marca:item.marca,
          modelo:item.modelo,
          categoria:item.categoria,
          cantidad:item.cantidad,
          tipo:'No serializado',
          seriales:[],
          imagen:item.imagen || ''
        });
      }
    }
  }

  const nombreOrigen = getNombre(origenTipo, origenIndex);
  const nombreDestino = getNombre(destinoTipo, destinoIndex);
  const resumenProductos = transferenciaActualItems.map(item => `${item.producto} (${item.cantidad})`).join(', ');
  const totalUnidades = transferenciaActualItems.reduce((sum, item) => sum + Number(item.cantidad || 0), 0);

  if(origenTipo === 'almacen'){
    registrarMovimientoAlmacen(origenIndex, 'Transferencia salida', referencia, observacion || `Transferencia a ${nombreDestino}`, usuario, tiempo, referencia);
  }
  if(destinoTipo === 'almacen'){
    registrarMovimientoAlmacen(destinoIndex, 'Transferencia entrada', referencia, observacion || `Transferencia desde ${nombreOrigen}`, usuario, tiempo, referencia);
  }

  transferenciasInventario.unshift({
    codigo: referencia,
    origen: nombreOrigen,
    destino: nombreDestino,
    producto: transferenciaActualItems.length === 1 ? transferenciaActualItems[0].producto : `${transferenciaActualItems[0].producto} (+${transferenciaActualItems.length - 1})`,
    productosResumen: resumenProductos,
    unidades: totalUnidades,
    fecha: tiempo.fecha,
    hora: tiempo.hora,
    fechaHora: tiempo.fechaHora,
    fechaVista: tiempo.fechaHora,
    fechaISO: tiempo.fechaISO,
    usuario,
    estado: 'Completada',
    observacion,
    items: transferenciaActualItems.map(item => ({...item})),
    tipoTransferencia: `${nombreTipoEntidad(origenTipo)} a ${nombreTipoEntidad(destinoTipo)}`
  });

  renderAlmacenes();
  renderAgencias();
  renderGrupos();
  llenarSelectsTransferencia();
  renderTransferencias();
  cerrarTransferencia();
}

function limpiarFiltrosTransferencia(){
  ['filtroTransferenciaOrigen','filtroTransferenciaDestino','filtroTransferenciaProducto','filtroTransferenciaDesde','filtroTransferenciaHasta','filtroTransferenciaSerializado','filtroTransferenciaUsuario','buscarTransferencia'].forEach(id=>{
    const el = document.getElementById(id);
    if(el) el.value = '';
  });
  const serial = document.getElementById('filtroTransferenciaSerializado');
  if(serial) serial.value = 'todos';
  renderTransferencias();
}

function aplicarFiltrosTransferencia(){
  renderTransferencias();
}

function actualizarDashboardTransferencias(){
  const hoy = obtenerFechaHoy();
  const total = transferenciasInventario.length;
  const hoyItems = transferenciasInventario.filter(t => t.fecha === hoy);
  const unidadesHoy = hoyItems.reduce((sum, item) => sum + (Number(item.unidades) || 0), 0);
  const totalEl = document.getElementById('dashTotalTransferencias');
  const hoyEl = document.getElementById('dashTransferenciasHoy');
  const uniEl = document.getElementById('dashUnidadesTransferidasHoy');
  if(totalEl) totalEl.innerText = total;
  if(hoyEl) hoyEl.innerText = hoyItems.length;
  if(uniEl) uniEl.innerText = unidadesHoy;
}

function renderTransferencias(){
  const tbody = document.getElementById('tabla-transferencias');
  if(!tbody) return;

  const origen = (document.getElementById('filtroTransferenciaOrigen')?.value || '').toLowerCase();
  const destino = (document.getElementById('filtroTransferenciaDestino')?.value || '').toLowerCase();
  const producto = (document.getElementById('filtroTransferenciaProducto')?.value || '').toLowerCase();
  const desde = document.getElementById('filtroTransferenciaDesde')?.value || '';
  const hasta = document.getElementById('filtroTransferenciaHasta')?.value || '';
  const serializado = (document.getElementById('filtroTransferenciaSerializado')?.value || 'todos').toLowerCase();
  const usuario = (document.getElementById('filtroTransferenciaUsuario')?.value || '').toLowerCase();
  const buscar = (document.getElementById('buscarTransferencia')?.value || '').toLowerCase();

  let filtradas = transferenciasInventario.filter(item => {
    const textoProductos = (item.productosResumen || item.producto || '').toLowerCase();
    const coincideOrigen = !origen || item.origen.toLowerCase().includes(origen);
    const coincideDestino = !destino || item.destino.toLowerCase().includes(destino);
    const coincideProducto = !producto || textoProductos.includes(producto);
    const coincideUsuario = !usuario || item.usuario.toLowerCase().includes(usuario);
    const coincideSerial = serializado === 'todos' || item.serializado === serializado;
    const coincideBuscar = !buscar || [item.codigo, item.origen, item.destino, item.producto, item.productosResumen, item.usuario, item.estado].join(' ').toLowerCase().includes(buscar);

    const [dd, mm, yyyy] = item.fecha.split('-');
    const itemISO = `${yyyy}-${mm}-${dd}`;
    const coincideDesde = !desde || itemISO >= desde;
    const coincideHasta = !hasta || itemISO <= hasta;

    return coincideOrigen && coincideDestino && coincideProducto && coincideUsuario && coincideSerial && coincideBuscar && coincideDesde && coincideHasta;
  });

  tbody.innerHTML = '';
  if(filtradas.length === 0){
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;color:#8a8a8a;font-style:italic;font-weight:700;padding:24px">No hay transferencias registradas con esos filtros.</td></tr>`;
  } else {
    filtradas.forEach(item => {
      tbody.innerHTML += `
        <tr>
          <td>${item.codigo}</td>
          <td>${item.origen}</td>
          <td>${item.destino}</td>
          <td>${item.producto}</td>
          <td><strong>${item.unidades}</strong></td>
          <td>${item.fechaHora || item.fecha}</td>
          <td>${item.usuario}</td>
          <td><span class="status-badge success">${item.estado}</span></td>
          <td class="actions"><i class="fas fa-eye" onclick="verDetalleTransferencia('${item.codigo}')"></i></td>
        </tr>
      `;
    });
  }

  actualizarDashboardTransferencias();
}

function verDetalleTransferencia(codigo){
  const transferencia = transferenciasInventario.find(item => item.codigo === codigo);
  if(!transferencia){
    alert('No se encontró el detalle de esta transferencia');
    return;
  }

  document.getElementById('detalleTransferenciaTitulo').innerText = 'Detalle de Transferencia';
  document.getElementById('detalleTransferenciaCodigo').innerText = transferencia.codigo;
  document.getElementById('detalleTransferenciaMeta').innerText = `${transferencia.origen} → ${transferencia.destino} · ${transferencia.fechaHora || transferencia.fecha} · ${transferencia.usuario}`;
  document.getElementById('detalleTransferenciaResumen').innerHTML = `
    -Productos: ${transferencia.items.length}<br>
    -Unidades: ${transferencia.unidades}<br>
    -Serializado: ${transferencia.serializado === 'si' ? 'Sí' : 'No'}<br>
    -Observación: ${transferencia.observacion || 'Sin comentario'}
  `;

  const body = document.getElementById('detalleTransferenciaItemsBody');
  body.innerHTML = '';
  transferencia.items.forEach(item => {
    const serialesTexto = item.serializado === 'si'
      ? (item.seriales && item.seriales.length ? item.seriales.join('<br>') : 'Sin seriales')
      : 'No aplica';
    body.innerHTML += `
      <tr>
        <td>${item.producto}</td>
        <td>${item.marca}</td>
        <td>${item.modelo}</td>
        <td>${item.categoria}</td>
        <td>${item.cantidad}</td>
        <td>${item.serializado === 'si' ? 'Serializado' : 'No serializado'}</td>
        <td>${serialesTexto}</td>
      </tr>
    `;
  });

  document.getElementById('modalDetalleTransferencia').style.display = 'flex';
}

function cerrarDetalleTransferencia(){
  document.getElementById('modalDetalleTransferencia').style.display = 'none';
}



function abrirModalAgencia(){
  editAgenciaIndex = null;
  document.getElementById('tituloModalAgencia').innerText = 'Crear Agencia';
  document.getElementById('agenciaNumero').value = '';
  document.getElementById('agenciaGrupo').value = '';
  document.getElementById('agenciaEncargado').value = '';
  if(document.getElementById('agenciaTipoAgencia')) document.getElementById('agenciaTipoAgencia').value = 'Agencia';
  if(document.getElementById('agenciaEstadoOperativo')) document.getElementById('agenciaEstadoOperativo').value = 'ACTIVA';
  document.getElementById('agenciaLatitud').value = '';
  document.getElementById('agenciaLongitud').value = '';
  document.getElementById('agenciaDireccion').value = '';
  document.getElementById('modalAgencia').style.display = 'flex';
}

function cerrarModalAgencia(){
  document.getElementById('modalAgencia').style.display = 'none';
}

function editarAgencia(i){
  const agencia = agencias[i];
  editAgenciaIndex = i;
  document.getElementById('tituloModalAgencia').innerText = 'Editar Agencia';
  document.getElementById('agenciaNumero').value = agencia.numero;
  document.getElementById('agenciaGrupo').value = getAgencyRealGroup(agencia);
  document.getElementById('agenciaEncargado').value = agencia.encargado;
  if(document.getElementById('agenciaTipoAgencia')) document.getElementById('agenciaTipoAgencia').value = getAgencyTipoAgencia(agencia);
  if(document.getElementById('agenciaEstadoOperativo')) document.getElementById('agenciaEstadoOperativo').value = getAgencyEstadoOperativo(agencia);
  document.getElementById('agenciaLatitud').value = agencia.latitud ?? '';
  document.getElementById('agenciaLongitud').value = agencia.longitud ?? '';
  document.getElementById('agenciaDireccion').value = agencia.direccion || agencia.nombre || '';
  document.getElementById('modalAgencia').style.display = 'flex';
}

function guardarAgencia(){
  const numero = String(document.getElementById('agenciaNumero').value || '').trim();
  const grupo = document.getElementById('agenciaGrupo').value.trim() || 'Grupo 00';
  const encargado = document.getElementById('agenciaEncargado').value.trim() || 'Sin encargado';
  const tipoAgencia = document.getElementById('agenciaTipoAgencia')?.value || 'Agencia';
  const estadoOperativo = normalizarEstadoAgencia(document.getElementById('agenciaEstadoOperativo')?.value || 'ACTIVA');
  const latitud = normalizarNumeroGeografico(document.getElementById('agenciaLatitud').value);
  const longitud = normalizarNumeroGeografico(document.getElementById('agenciaLongitud').value);
  const direccion = document.getElementById('agenciaDireccion').value.trim() || `Agencia ${numero}`;

  if(!numero){
    alert('Escribe el número de la agencia');
    return;
  }

  const existente = agencias.findIndex((a, idx) => String(a.numero) === numero && idx !== editAgenciaIndex);
  if(existente !== -1){
    alert('Ya existe una agencia con ese número');
    return;
  }

  let agenciaGuardada;
  if(editAgenciaIndex === null){
    agenciaGuardada = {
      numero: Number(numero),
      nombre: `Agencia ${String(numero).padStart(4, '0')}`,
      grupo,
      encargado,
      direccion,
      latitud,
      longitud,
      detalle: { tipoAgencia, estadoOperativo, grupoReal: grupo },
      grupoReal: grupo,
      estadoOperativo,
      equipos: []
    };
    agencias.push(agenciaGuardada);
  } else {
    agenciaGuardada = agencias[editAgenciaIndex];
    agenciaGuardada.numero = Number(numero);
    agenciaGuardada.nombre = `Agencia ${String(numero).padStart(4, '0')}`;
    agenciaGuardada.grupo = grupo;
    agenciaGuardada.encargado = encargado;
    agenciaGuardada.direccion = direccion;
    agenciaGuardada.latitud = latitud;
    agenciaGuardada.longitud = longitud;
    if(!agenciaGuardada.detalle) agenciaGuardada.detalle = {};
    agenciaGuardada.detalle.tipoAgencia = tipoAgencia;
    agenciaGuardada.detalle.estadoOperativo = estadoOperativo;
    agenciaGuardada.detalle.grupoReal = (grupo !== AGENCY_SPECIAL_CLOSED_GROUP ? grupo : (agenciaGuardada.detalle.grupoReal || agenciaGuardada.grupoReal || 'Grupo 00'));
    agenciaGuardada.grupoReal = agenciaGuardada.detalle.grupoReal;
    agenciaGuardada.estadoOperativo = estadoOperativo;
  }

  applyAgencyClosedStatusRule(agenciaGuardada, grupo);
  syncClosedAgenciesGroup();

  agencias.sort((a,b) => Number(a.numero) - Number(b.numero));
  renderAgencias();
  if(typeof syncAgencyToBackendCero === 'function') syncAgencyToBackendCero(agenciaGuardada);
  cerrarModalAgencia();
}


function lotekaEnsureAgenciasGruposBase(){
  try{
    const debeRepararAgencias = !Array.isArray(agencias) || agencias.length === 0;
    if(debeRepararAgencias){
      agencias = [
        ...AGENCIAS_GRUPO_44_COMPLETAS.map((numero) => createAgencyRecord(numero, 'Grupo 44', 'encargado1')),
        ...AGENCIAS_GRUPO_45_COMPLETAS.map((numero) => createAgencyRecord(numero, 'Grupo 45', 'Jose Pacheco')),
        ...AGENCIAS_GRUPO_42_COMPLETAS.map((numero) => createAgencyRecord(numero, 'Grupo 42', 'Jose Antonio')),
        ...AGENCIAS_GRUPO_08_COMPLETAS.map((numero) => createAgencyRecord(numero, 'Grupo 08', 'Yoscar G-8')),
        ...AGENCIAS_GRUPO_06_COMPLETAS.map((numero) => createAgencyRecord(numero, 'Grupo 06', 'Alejandro G-06')),
        ...AGENCIAS_GRUPO_01_COMPLETAS.map((numero) => createAgencyRecord(numero, 'Grupo 03', 'Juan Gavilan')),
        ...AGENCIAS_GRUPO_04_COMPLETAS.map((numero) => createAgencyRecord(numero, 'Grupo 04', 'Manuel Gomez')),
        ...AGENCIAS_GRUPO_05_COMPLETAS.map((numero) => createAgencyRecord(numero, 'Grupo 05', 'Norberto Reyes'))
      ].map((agencia) => {
        const numero = Number(agencia.numero);
        const geo = AGENCY_GEO_CATALOG[numero] || {};
        return {
          ...agencia,
          grupo: geo.grupo || agencia.grupo,
          encargado: geo.encargado || agencia.encargado,
          direccion: geo.direccion || agencia.direccion,
          latitud: typeof geo.lat === 'number' ? geo.lat : agencia.latitud,
          longitud: typeof geo.lng === 'number' ? geo.lng : agencia.longitud,
          detalle: {
            ...(agencia.detalle || {}),
            tipoAgencia: getFixedAgencyType(numero) || agencia.detalle?.tipoAgencia || agencia.tipoAgencia || 'Agencia',
            estadoOperativo: getAgencyEstadoOperativo(agencia)
          },
          tipoAgencia: getFixedAgencyType(numero) || agencia.tipoAgencia || agencia.detalle?.tipoAgencia || 'Agencia',
          estadoOperativo: getAgencyEstadoOperativo(agencia)
        };
      });
      agencias.forEach(agencia => applyAgencyClosedStatusRule(agencia));
    }

    const debeRepararGrupos = !Array.isArray(grupos) || grupos.length === 0;
    if(debeRepararGrupos){
      grupos = [
        {numero:'44', nombre:'Grupo 44', color:'#89c541', encargado:'encargado1', flota:'(829) 340-6805', extension:'1144', correo:'encargado1@grupoortiz.com.do', custodia:[], agencias:AGENCIAS_GRUPO_44_COMPLETAS.slice()},
        {numero:'45', nombre:'Grupo 45', color:'#2d9bf0', encargado:'Jose Pacheco', flota:'', extension:'', correo:'', custodia:[], agencias:AGENCIAS_GRUPO_45_COMPLETAS.slice()},
        {numero:'42', nombre:'Grupo 42', color:'#d43ad7', encargado:'Jose Antonio', flota:'', extension:'', correo:'', custodia:[], agencias:AGENCIAS_GRUPO_42_COMPLETAS.slice()},
        {numero:'08', nombre:'Grupo 08', color:'#00b8ff', encargado:'Yoscar G-8', flota:'', extension:'', correo:'', custodia:[], agencias:AGENCIAS_GRUPO_08_COMPLETAS.slice()},
        {numero:'06', nombre:'Grupo 06', color:'#16c172', encargado:'Alejandro G-06', flota:'', extension:'', correo:'', custodia:[], agencias:AGENCIAS_GRUPO_06_COMPLETAS.slice()},
        {numero:'03', nombre:'Grupo 03', color:'#0ea5c6', encargado:'Juan Gavilan', flota:'', extension:'', correo:'', custodia:[], agencias:AGENCIAS_GRUPO_01_COMPLETAS.slice()},
        {numero:'04', nombre:'Grupo 04', color:'#f59e0b', encargado:'Manuel Gomez', flota:'', extension:'', correo:'', custodia:[], agencias:AGENCIAS_GRUPO_04_COMPLETAS.slice()},
        {numero:'05', nombre:'Grupo 05', color:'#6366f1', encargado:'Norberto Reyes', flota:'', extension:'', correo:'', custodia:[], agencias:AGENCIAS_GRUPO_05_COMPLETAS.slice()},
        {numero:'00', nombre:AGENCY_SPECIAL_CLOSED_GROUP, color:'#4b5563', encargado:'Sistema', flota:'', extension:'', correo:'', custodia:[], agencias:[]}
      ];
    }
    syncClosedAgenciesGroup();
    window.agencias = agencias;
    window.grupos = grupos;
  }catch(error){
    console.warn('No se pudo reparar la base local de agencias/grupos:', error);
  }
}



/* ===== Motor de paginación local para tablas largas ===== */
const LOTEKA_PAGINATION_STATE = window.LOTEKA_PAGINATION_STATE || {};
window.LOTEKA_PAGINATION_STATE = LOTEKA_PAGINATION_STATE;

function lotekaEscapeHtml(value){
  return String(value ?? '').replace(/[&<>'"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
}

function lotekaGetPaginationId(tbodyId){
  return `${tbodyId}Pagination`;
}

function lotekaEnsurePaginationHost(tbodyId){
  const tbody = document.getElementById(tbodyId);
  if(!tbody) return null;
  let host = document.getElementById(lotekaGetPaginationId(tbodyId));
  if(host) return host;
  host = document.createElement('div');
  host.id = lotekaGetPaginationId(tbodyId);
  host.className = 'ltk-pagination';
  const wrap = tbody.closest('.table-wrap') || tbody.closest('table');
  if(wrap && wrap.parentNode){
    wrap.parentNode.insertBefore(host, wrap.nextSibling);
  }else{
    tbody.parentNode.appendChild(host);
  }
  return host;
}

function lotekaResetPagination(tbodyId){
  if(!LOTEKA_PAGINATION_STATE[tbodyId]) LOTEKA_PAGINATION_STATE[tbodyId] = {page:1, pageSize:10};
  LOTEKA_PAGINATION_STATE[tbodyId].page = 1;
}

function lotekaSetPage(tbodyId, page){
  if(!LOTEKA_PAGINATION_STATE[tbodyId]) LOTEKA_PAGINATION_STATE[tbodyId] = {page:1, pageSize:10};
  LOTEKA_PAGINATION_STATE[tbodyId].page = Number(page) || 1;
  if(typeof LOTEKA_PAGINATION_STATE[tbodyId].render === 'function') LOTEKA_PAGINATION_STATE[tbodyId].render();
}

function lotekaSetPageSize(tbodyId, size){
  if(!LOTEKA_PAGINATION_STATE[tbodyId]) LOTEKA_PAGINATION_STATE[tbodyId] = {page:1, pageSize:10};
  LOTEKA_PAGINATION_STATE[tbodyId].pageSize = Number(size) || 10;
  LOTEKA_PAGINATION_STATE[tbodyId].page = 1;
  if(typeof LOTEKA_PAGINATION_STATE[tbodyId].render === 'function') LOTEKA_PAGINATION_STATE[tbodyId].render();
}

function lotekaRenderPaginatedRows(tbodyId, rows, options = {}){
  const tbody = document.getElementById(tbodyId);
  if(!tbody) return;
  const host = lotekaEnsurePaginationHost(tbodyId);
  const state = LOTEKA_PAGINATION_STATE[tbodyId] || {page:1, pageSize:Number(options.defaultPageSize) || 10};
  state.pageSize = Number(state.pageSize || options.defaultPageSize || 10);
  state.render = () => lotekaRenderPaginatedRows(tbodyId, rows, options);
  LOTEKA_PAGINATION_STATE[tbodyId] = state;

  const total = Array.isArray(rows) ? rows.length : 0;
  const colspan = options.colspan || tbody.parentElement?.querySelectorAll('thead th')?.length || 1;
  if(!total){
    tbody.innerHTML = `<tr><td colspan="${colspan}" class="muted-empty" style="text-align:center; padding:32px;">${options.emptyMessage || 'No hay registros para mostrar.'}</td></tr>`;
    if(host) host.innerHTML = '';
    return;
  }

  const totalPages = Math.max(1, Math.ceil(total / state.pageSize));
  state.page = Math.min(Math.max(Number(state.page) || 1, 1), totalPages);
  const start = (state.page - 1) * state.pageSize;
  const end = Math.min(start + state.pageSize, total);
  tbody.innerHTML = rows.slice(start, end).join('');

  if(!host) return;
  const pageWindow = [];
  const from = Math.max(1, state.page - 2);
  const to = Math.min(totalPages, state.page + 2);
  for(let p = from; p <= to; p++) pageWindow.push(p);
  const sizes = [10,25,50,100];
  host.innerHTML = `
    <div class="ltk-pagination-shell">
      <div class="ltk-pagination-info">
        <span class="ltk-info-dot"></span>
        <span>Mostrando <strong>${start + 1}-${end}</strong> de <strong>${total}</strong> registros</span>
      </div>
      <div class="ltk-pagination-main" aria-label="Paginación">
        <button class="ltk-page-btn ltk-nav-btn" ${state.page === 1 ? 'disabled' : ''} onclick="lotekaSetPage('${tbodyId}',1)" title="Primera página">«</button>
        <button class="ltk-page-btn ltk-nav-btn ltk-prev-next" ${state.page === 1 ? 'disabled' : ''} onclick="lotekaSetPage('${tbodyId}',${state.page - 1})" title="Página anterior">Anterior</button>
        <div class="ltk-page-numbers">
          ${pageWindow.map(p => `<button class="ltk-page-btn ${p === state.page ? 'active' : ''}" onclick="lotekaSetPage('${tbodyId}',${p})">${p}</button>`).join('')}
        </div>
        <button class="ltk-page-btn ltk-nav-btn ltk-prev-next" ${state.page === totalPages ? 'disabled' : ''} onclick="lotekaSetPage('${tbodyId}',${state.page + 1})" title="Página siguiente">Siguiente</button>
        <button class="ltk-page-btn ltk-nav-btn" ${state.page === totalPages ? 'disabled' : ''} onclick="lotekaSetPage('${tbodyId}',${totalPages})" title="Última página">»</button>
      </div>
      <div class="ltk-page-size-group" aria-label="Registros por página">
        <span>Ver</span>
        ${sizes.map(size => `<button type="button" class="ltk-size-btn ${Number(state.pageSize) === size ? 'active' : ''}" onclick="lotekaSetPageSize('${tbodyId}', ${size})">${size}</button>`).join('')}
      </div>
    </div>`;
}

function lotekaAgencyAdminText(value){
  return String(value ?? '').replace(/[&<>'"]/g, function(c){
    return {'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c];
  });
}

function lotekaAgencyAdminNorm(value){
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
}

function lotekaAgencyNumber(agencia){
  return String(agencia?.numero ?? '').padStart(4, '0');
}

function lotekaAgencyNumeroSolo(value){
  const raw = String(value ?? '').trim();
  if(!raw) return '';
  const match = raw.match(/(\d{1,4})/);
  return match ? String(Number(match[1])).padStart(4, '0') : raw;
}

function lotekaAgencyLabelSolo(agencia){
  return lotekaAgencyNumeroSolo(agencia?.numero ?? agencia?.agencia ?? agencia?.agency ?? agencia?.id ?? '');
}

function lotekaCleanAgencyText(value){
  const raw = String(value ?? '').trim();
  if(!raw) return '';
  const match = raw.match(/(?:Agencia\s*)?(\d{1,4})/i);
  return match ? String(Number(match[1])).padStart(4, '0') : raw.replace(/\s*,?\s*G-\d{1,2}\b/ig,'').replace(/^Agencia\s*/i,'').trim();
}

function lotekaGroupFromAgencyText(value, fallback=''){
  const raw = String(value ?? '').trim();
  const match = raw.match(/\bG-(\d{1,2})\b/i);
  if(match) return `Grupo ${match[1].padStart(2,'0')}`;
  return fallback || '';
}

function lotekaAgencyTypeValue(agencia){
  const raw = agencia?.detalle?.tipoAgencia || agencia?.tipo || agencia?.tipoAgencia || 'Agencia';
  return typeof normalizarTipoAgencia === 'function' ? normalizarTipoAgencia(raw) : String(raw || 'Agencia');
}

function lotekaAgencyTypeClass(tipo){
  const n = lotekaAgencyAdminNorm(tipo);
  if(n.includes('centro')) return 'centro';
  if(n.includes('punto')) return 'punto';
  if(n.includes('super')) return 'super';
  return 'normal';
}

function lotekaAgencyStatusClassV80(estado){
  const n = lotekaAgencyAdminNorm(estado);
  if(n.includes('activa')) return 'activa';
  if(n.includes('proceso')) return 'proceso';
  if(n.includes('remodel')) return 'remodelacion';
  if(n.includes('cerrada') || n.includes('desactiv')) return 'cerrada';
  return 'otro';
}

function lotekaPopulateAgencyAdminFilters(){
  const groupSelect = document.getElementById('agencyGroupFilter');
  const typeSelect = document.getElementById('agencyTypeFilter');
  const statusSelect = document.getElementById('agencyStatusFilter');
  if(!groupSelect || !typeSelect || !statusSelect) return;

  const previous = {
    group: groupSelect.value,
    type: typeSelect.value,
    status: statusSelect.value
  };

  const groups = Array.from(new Set((agencias || []).map(a => agenciaMapGroupValue(a)).filter(Boolean)))
    .sort((a,b) => String(a).localeCompare(String(b), 'es', {numeric:true}));
  const types = Array.from(new Set((agencias || []).map(a => lotekaAgencyTypeValue(a)).filter(Boolean)))
    .sort((a,b) => String(a).localeCompare(String(b), 'es', {numeric:true}));
  const statuses = Array.from(new Set((agencias || []).map(a => getAgencyEstadoOperativo(a)).filter(Boolean)))
    .sort((a,b) => String(a).localeCompare(String(b), 'es', {numeric:true}));

  groupSelect.innerHTML = '<option value="">Todos</option>' + groups.map(g => `<option value="${lotekaAgencyAdminText(g)}">${lotekaAgencyAdminText(g)}</option>`).join('');
  typeSelect.innerHTML = '<option value="">Todos</option>' + types.map(t => `<option value="${lotekaAgencyAdminText(t)}">${lotekaAgencyAdminText(t)}</option>`).join('');
  statusSelect.innerHTML = '<option value="">Todos</option>' + statuses.map(s => `<option value="${lotekaAgencyAdminText(s)}">${lotekaAgencyAdminText(s)}</option>`).join('');

  groupSelect.value = previous.group;
  typeSelect.value = previous.type;
  statusSelect.value = previous.status;
}

function lotekaClearAgencyFilters(){
  window.lotekaAgencyLatestMode = false;
  const search = document.getElementById('agencySearchInput');
  const group = document.getElementById('agencyGroupFilter');
  const type = document.getElementById('agencyTypeFilter');
  const status = document.getElementById('agencyStatusFilter');
  if(search) search.value = '';
  if(group) group.value = '';
  if(type) type.value = '';
  if(status) status.value = '';
  renderAgencias();
}

function lotekaAgencyCreationTime(agencia){
  const raw = agencia?.fechaCreacion || agencia?.fecha_creacion || agencia?.createdAt || agencia?.created_at || agencia?.fecha;
  const d = raw ? new Date(raw) : null;
  return d && !Number.isNaN(d.getTime()) ? d.getTime() : 0;
}

function lotekaAgencyCreationLabel(agencia){
  const raw = agencia?.fechaCreacion || agencia?.fecha_creacion || agencia?.createdAt || agencia?.created_at || agencia?.fecha || agencia?.detalle?.fechaCreacion;
  const d = raw ? new Date(raw) : null;
  if(!d || Number.isNaN(d.getTime())) return 'Sin fecha';
  try{ return d.toLocaleDateString('es-DO', {day:'2-digit', month:'2-digit', year:'numeric'}); }catch(e){}
  const pad = n => String(n).padStart(2,'0');
  return `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()}`;
}

function lotekaShowLatestAgenciesCreated(){
  window.lotekaAgencyLatestMode = true;
  const search = document.getElementById('agencySearchInput');
  const group = document.getElementById('agencyGroupFilter');
  const type = document.getElementById('agencyTypeFilter');
  const status = document.getElementById('agencyStatusFilter');
  if(search) search.value = '';
  if(group) group.value = '';
  if(type) type.value = '';
  if(status) status.value = '';
  try{ cambiarVista('agencias', document.querySelector('[onclick*=\"agencias\"]')); }catch(e){ try{ cambiarVista('agencias', null); }catch(_e){} }
  setTimeout(function(){
    try{ renderAgencias(); }catch(e){}
    const table = document.querySelector('#vista-agencias .agency-admin-table');
    if(table){ try{ table.scrollIntoView({behavior:'smooth', block:'start'}); }catch(e){} }
  }, 120);
}

function renderAgencias(){
  lotekaEnsureAgenciasGruposBase();
  const tbody = document.getElementById('tabla-agencias');
  if(!tbody) return;

  lotekaPopulateAgencyAdminFilters();

  const query = lotekaAgencyAdminNorm(document.getElementById('agencySearchInput')?.value || '');
  const groupFilter = document.getElementById('agencyGroupFilter')?.value || '';
  const typeFilter = document.getElementById('agencyTypeFilter')?.value || '';
  const statusFilter = document.getElementById('agencyStatusFilter')?.value || '';

  let filtered = agencias.filter((agencia) => {
    const numero = lotekaAgencyNumber(agencia);
    const grupoMapa = agenciaMapGroupValue(agencia);
    const tipo = lotekaAgencyTypeValue(agencia);
    const estado = getAgencyEstadoOperativo(agencia);
    const encargado = String(agencia.encargado || '');
    const geo = typeof formatAgencyGeoText === 'function' ? formatAgencyGeoText(agencia) : '';
    const searchable = lotekaAgencyAdminNorm([
      numero,
      `Agencia ${numero}`,
      grupoMapa,
      agencia.grupo,
      getAgencyRealGroup(agencia),
      encargado,
      tipo,
      estado,
      geo
    ].join(' '));

    const matchesQuery = !query || searchable.includes(query);
    const matchesGroup = !groupFilter || grupoMapa === groupFilter;
    const matchesType = !typeFilter || tipo === typeFilter;
    const matchesStatus = !statusFilter || estado === statusFilter;
    return matchesQuery && matchesGroup && matchesType && matchesStatus;
  });

  if(window.lotekaAgencyLatestMode){
    filtered = filtered.slice().sort((a,b) => lotekaAgencyCreationTime(b) - lotekaAgencyCreationTime(a) || Number(b?.numero || 0) - Number(a?.numero || 0)).slice(0, 20);
  }

  const rows = filtered.map((agencia) => {
    const realIndex = agencias.findIndex(item => Number(item.numero) === Number(agencia.numero));
    const numero = lotekaAgencyNumber(agencia);
    const grupo = agenciaMapGroupValue(agencia);
    const encargado = agencia.encargado || 'Sin encargado';
    const tipo = lotekaAgencyTypeValue(agencia);
    const estado = getAgencyEstadoOperativo(agencia);
    const fechaCreacion = lotekaAgencyCreationLabel(agencia);
    const geo = typeof formatAgencyGeoText === 'function' ? formatAgencyGeoText(agencia) : 'Sin ubicación';
    return `
      <tr>
        <td><span class="agency-num-chip">${lotekaAgencyAdminText(numero)}</span></td>
        <td><span class="agency-group-chip"><i class="fas fa-layer-group"></i> ${lotekaAgencyAdminText(grupo)}</span></td>
        <td><div class="agency-manager-name">${lotekaAgencyAdminText(encargado)}</div></td>
        <td><span class="agency-type-pill ${lotekaAgencyTypeClass(tipo)}">${lotekaAgencyAdminText(tipo)}</span></td>
        <td><span class="agency-status-pill-v80 ${lotekaAgencyStatusClassV80(estado)}">${lotekaAgencyAdminText(estado)}</span></td>
        <td><span class="agency-date-chip"><i class="fas fa-calendar-day"></i> ${lotekaAgencyAdminText(fechaCreacion)}</span></td>
        <td><div class="agency-location-mini">${lotekaAgencyAdminText(geo)}</div></td>
        <td><div class="agency-admin-actions-cell"><button class="agency-action-btn" type="button" onclick="verDetalleAgencia(${realIndex})" title="Consultar"><i class="fas fa-eye"></i></button><button class="agency-action-btn" type="button" onclick="editarAgencia(${realIndex})" title="Editar"><i class="fas fa-pen"></i></button></div></td>
      </tr>
    `;
  });

  lotekaRenderPaginatedRows('tabla-agencias', rows, {colspan:8, emptyMessage:'No se encontraron agencias con esos filtros.', defaultPageSize:10});

  const totalEl = document.getElementById('agencyAdminTotal') || document.getElementById('dashTotalAgencias');
  if(totalEl) totalEl.innerText = agencias.length;
  const countEl = document.getElementById('agencyAdminCount');
  if(countEl){
    countEl.innerText = window.lotekaAgencyLatestMode
      ? `Últimas ${filtered.length} agencias creadas`
      : `${filtered.length} ${filtered.length === 1 ? 'resultado' : 'resultados'}`;
  }
  if(typeof agencyMapRefresh === 'function') agencyMapRefresh(agencias);
}

function ensureAgencyDetailDefaults(agencia){
  if(!agencia.detalle) agencia.detalle = {};
  const numeroTxt = String(agencia.numero || '').padStart(4,'0');
  agencia.detalle = {
    numeroVisible: numeroTxt,
    go: agencia.detalle.go || numeroTxt,
    ltk: agencia.detalle.ltk || `LTK-${numeroTxt}`,
    telefono: agencia.detalle.telefono || '',
    horario: agencia.detalle.horario || '8:00 AM - 6:00 PM',
    estadoOperativo: getAgencyEstadoOperativo(agencia),
    tipoAgencia: normalizarTipoAgencia(agencia.detalle.tipoAgencia || 'Agencia'),
    observacion: agencia.detalle.observacion || '',
    estructura: {
      toldo: agencia.detalle.estructura?.toldo || 'Buen Estado',
      techo: agencia.detalle.estructura?.techo || 'Buen Estado',
      pintura: agencia.detalle.estructura?.pintura || 'Buen Estado',
      piso: agencia.detalle.estructura?.piso || 'Buen Estado',
      puerta: agencia.detalle.estructura?.puerta || 'Buen Estado',
      counter: agencia.detalle.estructura?.counter || 'Buen Estado',
      cliente: agencia.detalle.estructura?.cliente || 'Ordenada',
      empleada: agencia.detalle.estructura?.empleada || 'Ordenada',
      comentario: agencia.detalle.estructura?.comentario || ''
    },
    legal: {
      propietario: agencia.detalle.legal?.propietario || '',
      documento: agencia.detalle.legal?.documento || '',
      telefono: agencia.detalle.legal?.telefono || '',
      estado: agencia.detalle.legal?.estado || 'Al día',
      inicio: agencia.detalle.legal?.inicio || '',
      vencimiento: agencia.detalle.legal?.vencimiento || '',
      observacion: agencia.detalle.legal?.observacion || ''
    },
    permisos: {
      inventario: agencia.detalle.permisos?.inventario || 'Sí',
      serializados: agencia.detalle.permisos?.serializados || 'Sí',
      soporte: agencia.detalle.permisos?.soporte || 'Sí',
      acceso: agencia.detalle.permisos?.acceso || 'Activo',
      movimientos: agencia.detalle.permisos?.movimientos || 'Habilitado',
      especial: agencia.detalle.permisos?.especial || 'Ninguno'
    },
    parametros: {
      tecnico: agencia.detalle.parametros?.tecnico || '',
      supervisor: agencia.detalle.parametros?.supervisor || '',
      prioridad: agencia.detalle.parametros?.prioridad || 'Media',
      canal: agencia.detalle.parametros?.canal || 'Operaciones',
      ruta: agencia.detalle.parametros?.ruta || '',
      horarioRuta: agencia.detalle.parametros?.horarioRuta || '',
      ultimaVisita: agencia.detalle.parametros?.ultimaVisita || '',
      proximaRevision: agencia.detalle.parametros?.proximaRevision || '',
      nota: agencia.detalle.parametros?.nota || ''
    },
    galeria: {
      exterior: agencia.detalle.galeria?.exterior || '',
      cliente: agencia.detalle.galeria?.cliente || '',
      empleada: agencia.detalle.galeria?.empleada || ''
    }
  };
}


function agencyDigits(value){ return String(value || '').replace(/\D+/g,''); }
function agencyRecordMatches(record, agencia){
  const agencyNum = agencyDigits(agencia?.numero || agencia?.detalle?.go || '');
  const candidates = [record?.agency, record?.agencia, record?.location, record?.codigo_agencia, record?.agencyCode, record?.go].map(v => String(v || ''));
  return candidates.some(v => agencyDigits(v) === agencyNum) || String(record?.agency || '').toLowerCase().includes(String(agenciaNum).toLowerCase());
}
function agencyLoadOperationsRecords(){
  /*
    OPERACIONES / CAPA A2 - Paso 3:
    Centro de consultas ya no lee operaciones desde localStorage.
    Usa la memoria segura alimentada por Supabase/loadOperations().
  */
  try{
    if(typeof window.loadOperations === 'function'){
      const list = window.loadOperations();
      return Array.isArray(list) ? list : [];
    }
  }catch(e){}

  try{
    if(Array.isArray(window.operations)) return window.operations;
  }catch(e){}

  try{
    if(typeof operations !== 'undefined' && Array.isArray(operations)) return operations;
  }catch(e){}

  return [];
}
function agencyLoadLevantamientosRecords(){
  try {
    if (typeof levRecords !== 'undefined' && Array.isArray(levRecords) && levRecords.length) {
      return levRecords.map(item => typeof levNormalizeItem === 'function' ? levNormalizeItem(item) : item);
    }
  } catch(e) {}
  try {
    return JSON.parse(localStorage.getItem(typeof LEV_STORAGE_KEY !== 'undefined' ? LEV_STORAGE_KEY : 'loteka_operaciones_levantamientos_v2') || '[]');
  } catch(e){ return []; }
}
function agencyFmtShortDate(value){ if(!value) return '-'; const d = new Date(value.length===10 ? `${value}T00:00:00` : value); return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString('es-DO',{day:'2-digit',month:'2-digit',year:'numeric'}); }
function agencyGetWorksForAgency(agencia){
  return agencyLoadOperationsRecords().filter(item => String(item?.type || '').toLowerCase() === 'trabajo' && agencyRecordMatches(item, agencia)).sort((a,b) => new Date(b.completedAt || b.updatedAt || b.createdAt || 0) - new Date(a.completedAt || a.updatedAt || a.createdAt || 0));
}
function agencyGetLevsForAgency(agencia){
  return agencyLoadLevantamientosRecords().filter(item => agencyRecordMatches(item, agencia)).sort((a,b) => new Date(b.submittedAt || b.updatedAt || b.visitDate || 0) - new Date(a.submittedAt || a.updatedAt || a.visitDate || 0));
}
function agencyRenderWorks(agencia){
  const tbody = document.getElementById('agencyStructureWorksBody'); if(!tbody) return;
  const works = agencyGetWorksForAgency(agencia);
  if(!works.length){ tbody.innerHTML = `<tr><td colspan="7"><div class="lev-empty">No fueron encontrados trabajos de estructura física para esta agencia.</div></td></tr>`; return; }
  tbody.innerHTML = works.map(item => {
    const imgs = (Array.isArray(item.resultImages) ? item.resultImages.filter(Boolean).length : 0) + (Array.isArray(item.images) ? item.images.filter(Boolean).length : 0);
    const pdf = item.pdf || item.supportPdf || item.facturaPdf || '';
    const factura = item.factura || item.invoice || item.invoiceNumber || '';
    return `<tr>
      <td><strong>${item.title || item.description || 'Trabajo registrado'}</strong><br><span style="color:#6d8799">${(item.selectedTypes||[]).join(', ') || 'Sin clasificación específica'}</span></td>
      <td>${item.technician || item.owner || item.supplier || 'No registrado'}</td>
      <td><span class="status-pill ${String(item.status||'').toLowerCase().includes('complet') ? 'green' : 'blue'}">${item.status || 'Pendiente'}</span></td>
      <td>${agencyFmtShortDate(item.completedAt || item.updatedAt || item.createdAt || '')}</td>
      <td>${imgs || 0}</td>
      <td>${factura ? 'Sí' : 'No'}</td>
      <td>${pdf ? `<a href="${pdf}" target="_blank" rel="noopener">Ver PDF</a>` : '—'}</td>
    </tr>`;
  }).join('');
}
function agencyRenderLevantamientos(agencia){
  const tbody = document.getElementById('agencyLevantamientosBody'); if(!tbody) return;
  const levs = agencyGetLevsForAgency(agencia);
  if(!levs.length){ tbody.innerHTML = `<tr><td colspan="8"><div class="lev-empty">No hay levantamientos vinculados a esta agencia.</div></td></tr>`; return; }
  tbody.innerHTML = levs.map(item => `<tr>
    <td><strong>${item.code || '-'}</strong></td>
    <td>${item.type || item.category || '-'}</td>
    <td>${item.technician || item.responsible || '-'}</td>
    <td><span class="status-pill blue">${item.overallStatus || '-'}</span></td>
    <td><span class="status-pill ${String(item.priority||'').toLowerCase().includes('alta') || String(item.priority||'').toLowerCase().includes('urg') ? 'gold' : 'gray'}">${item.priority || '-'}</span></td>
    <td>${agencyFmtShortDate(item.visitDate || item.submittedAt || '')}</td>
    <td>${item.findingsCount ?? 0}</td>
    <td><button class="btn-secondary" type="button" onclick="agencyViewLev('${item.id}')">Ver</button></td>
  </tr>`).join('');
}
function agencyViewLev(id){
  const item = agencyLoadLevantamientosRecords().find(row => String(row.id) === String(id));
  if(!item){ alert('No se encontró el expediente de levantamiento.'); return; }
  const lines = [
    `${item.code || ''} · Agencia ${item.agency || '-'}`,
    `Tipo: ${item.type || item.category || '-'}`,
    `Técnico: ${item.technician || item.responsible || '-'}`,
    `Estado general: ${item.overallStatus || '-'}`,
    `Prioridad: ${item.priority || '-'}`,
    `Fecha: ${agencyFmtShortDate(item.visitDate || item.submittedAt || '')}`,
    '',
    item.executiveSummary || item.findings || 'Sin resumen disponible.'
  ];
  alert(lines.join('\n'));
}
function agencyRenderGallery(agencia){
  const holder = document.getElementById('agencyGalleryAutoGrid'); if(!holder) return;
  const cards = [];
  const d = agencia?.detalle || {};
  const baseGallery = d.galeria || {};
  [['Exterior base', baseGallery.exterior], ['Zona cliente base', baseGallery.cliente], ['Zona empleada base', baseGallery.empleada]].forEach(([label,url]) => {
    cards.push({label, url, source:'Expediente'});
  });
  agencyGetLevsForAgency(agencia).forEach(item => (item.gallery || []).forEach(photo => cards.push({label: photo.label || 'Levantamiento', url: photo.url || '', source: item.code || 'Levantamiento'})));
  agencyGetWorksForAgency(agencia).forEach(item => {
    (Array.isArray(item.resultImages) ? item.resultImages : []).filter(Boolean).forEach((url, idx) => cards.push({label:`Resultado trabajo ${idx+1}`, url, source:item.code || item.title || 'Trabajo'}));
    (Array.isArray(item.images) ? item.images : []).filter(Boolean).forEach((url, idx) => cards.push({label:`Imagen inicial ${idx+1}`, url, source:item.code || item.title || 'Trabajo'}));
  });
  if(!cards.length){ holder.innerHTML = '<div class="lev-empty">No hay evidencias visuales vinculadas a esta agencia.</div>'; return; }
  holder.innerHTML = cards.map(card => `<div class="agency-gallery-card"><div class="agency-gallery-preview">${card.url ? `<img src="${card.url}" alt="${card.label}">` : card.label}</div><div class="agency-gallery-meta"><strong>${card.label}</strong><span>${card.source}</span></div></div>`).join('');
}
function agencyRenderDashboard(agencia){
  const works = agencyGetWorksForAgency(agencia);
  const levs = agencyGetLevsForAgency(agencia);
  const pending = works.filter(item => !String(item.status || '').toLowerCase().includes('complet')).length + levs.filter(item => !String(item.workflowStatus || '').toLowerCase().includes('complet') && !String(item.workflowStatus || '').toLowerCase().includes('archiv')).length;
  const latestLev = levs[0];
  const latestWork = works[0];
  const latestTech = latestLev?.technician || latestLev?.responsible || latestWork?.technician || '-';
  const set = (id, val) => { const el = document.getElementById(id); if(el) el.textContent = val; };
  set('detalleAgenciaTrabajos', works.length);
  set('detalleAgenciaLevantamientos', levs.length);
  set('detalleAgenciaPendientes', pending);
  set('detalleAgenciaUltimoTecnico', latestTech);
  const summary = document.getElementById('agencyDashboardSummary');
  if(summary){
    summary.innerHTML = `La agencia <strong>${String(agencia.numero || '').padStart(4,'0')}</strong> tiene <strong>${works.length}</strong> trabajo(s) registrado(s) y <strong>${levs.length}</strong> levantamiento(s) técnico(s) vinculados. ` +
      `El último levantamiento fue <strong>${latestLev ? agencyFmtShortDate(latestLev.visitDate || latestLev.submittedAt || '') : '-'}</strong> y el último trabajo quedó en estado <strong>${latestWork?.status || 'Sin trabajos'}</strong>.`;
  }
  const timeline = document.getElementById('agencyDashboardTimeline');
  if(timeline){
    const items = [];
    if(latestLev) items.push(`<div class="lev-mini-item"><div><strong>${latestLev.code || 'Levantamiento'}</strong><span>${latestLev.executiveSummary || latestLev.type || latestLev.category || ''}</span></div><b>${agencyFmtShortDate(latestLev.visitDate || latestLev.submittedAt || '')}</b></div>`);
    if(latestWork) items.push(`<div class="lev-mini-item"><div><strong>${latestWork.code || 'Trabajo'}</strong><span>${latestWork.title || latestWork.description || 'Trabajo registrado'}</span></div><b>${agencyFmtShortDate(latestWork.completedAt || latestWork.updatedAt || latestWork.createdAt || '')}</b></div>`);
    timeline.innerHTML = items.length ? items.join('') : '<div class="lev-empty">Sin movimientos registrados.</div>';
  }
}

function cargarVistaPreviaAgencia(id, src, fallback){
  const box = document.getElementById(id);
  if(!box) return;
  if(src){
    box.innerHTML = `<img src="${src}" alt="preview">`;
  } else {
    box.textContent = fallback;
  }
}


function agencySetValue(id, value){
  const el = document.getElementById(id);
  if(el) el.value = value ?? '';
}
function agencySetText(id, value){
  const el = document.getElementById(id);
  if(el) el.innerText = value ?? '';
}
function agencySetHref(id, value){
  const el = document.getElementById(id);
  if(el) el.href = value || '#';
}

function cargarFormularioDetalleAgencia(agencia){
  ensureAgencyDetailDefaults(agencia);
  const d = agencia.detalle || {};
  agencySetValue('agencyFieldNumero', String(agencia.numero || ''));
  agencySetValue('agencyFieldGrupo', getAgencyRealGroup(agencia));
  agencySetValue('agencyFieldEncargado', agencia.encargado || '');
  agencySetValue('agencyFieldGo', d.go || '');
  agencySetValue('agencyFieldLtk', d.ltk || '');
  agencySetValue('agencyFieldEstadoOperativo', getAgencyEstadoOperativo(agencia));
  agencySetValue('agencyFieldTipoAgencia', normalizarTipoAgencia(d.tipoAgencia || 'Agencia'));
  agencySetValue('agencyFieldTelefono', d.telefono || '');
  agencySetValue('agencyFieldHorario', d.horario || '');
  agencySetValue('agencyFieldDireccion', agencia.direccion || '');
  agencySetValue('agencyFieldLatitud', agencia.latitud ?? '');
  agencySetValue('agencyFieldLongitud', agencia.longitud ?? '');
  agencySetValue('detalleAgenciaGeoTexto', typeof formatAgencyGeoText === 'function' ? formatAgencyGeoText(agencia) : '');
  agencySetValue('agencyFieldObservacion', d.observacion || '');

  const es = d.estructura || {};
  agencySetValue('agencyStructToldo', es.toldo || 'Buen Estado');
  agencySetValue('agencyStructTecho', es.techo || 'Buen Estado');
  agencySetValue('agencyStructPintura', es.pintura || 'Buen Estado');
  agencySetValue('agencyStructPiso', es.piso || 'Buen Estado');
  agencySetValue('agencyStructPuerta', es.puerta || 'Buen Estado');
  agencySetValue('agencyStructCounter', es.counter || 'Buen Estado');
  agencySetValue('agencyStructCliente', es.cliente || 'Buen Estado');
  agencySetValue('agencyStructEmpleada', es.empleada || 'Buen Estado');
  agencySetValue('agencyStructComentario', es.comentario || '');

  const legal = d.legal || {};
  agencySetValue('agencyLegalPropietario', legal.propietario || '');
  agencySetValue('agencyLegalDocumento', legal.documento || '');
  agencySetValue('agencyLegalTelefono', legal.telefono || '');
  agencySetValue('agencyLegalEstado', legal.estado || 'Al día');
  agencySetValue('agencyLegalInicio', legal.inicio || '');
  agencySetValue('agencyLegalVencimiento', legal.vencimiento || '');
  agencySetValue('agencyLegalObservacion', legal.observacion || '');

  const permisos = d.permisos || {};
  agencySetValue('agencyPermInventario', permisos.inventario || 'Sí');
  agencySetValue('agencyPermSerializados', permisos.serializados || 'Sí');
  agencySetValue('agencyPermSoporte', permisos.soporte || 'Sí');
  agencySetValue('agencyPermAcceso', permisos.acceso || 'Activo');
  agencySetValue('agencyPermMovimientos', permisos.movimientos || 'Habilitado');
  agencySetValue('agencyPermEspecial', permisos.especial || 'Ninguno');

  const parametros = d.parametros || {};
  agencySetValue('agencyParamTecnico', parametros.tecnico || '');
  agencySetValue('agencyParamSupervisor', parametros.supervisor || '');
  agencySetValue('agencyParamPrioridad', parametros.prioridad || 'Media');
  agencySetValue('agencyParamCanal', parametros.canal || 'Operaciones');
  agencySetValue('agencyParamRuta', parametros.ruta || '');
  agencySetValue('agencyParamHorario', parametros.horarioRuta || d.horario || '');
  agencySetValue('agencyParamUltimaVisita', parametros.ultimaVisita || '');
  agencySetValue('agencyParamProximaRevision', parametros.proximaRevision || '');
  agencySetValue('agencyParamNota', parametros.nota || '');

  const gal = d.galeria || {};
  cargarVistaPreviaAgencia('galleryExteriorPreview', gal.exterior, 'Exterior de la agencia');
  cargarVistaPreviaAgencia('galleryClientePreview', gal.cliente, 'Zona de cliente');
  cargarVistaPreviaAgencia('galleryEmpleadaPreview', gal.empleada, 'Zona de empleada');

  if(typeof agencyRenderDashboard === 'function') agencyRenderDashboard(agencia);
  if(typeof agencyRenderWorks === 'function') agencyRenderWorks(agencia);
  if(typeof agencyRenderLevantamientos === 'function') agencyRenderLevantamientos(agencia);
  if(typeof agencyRenderGallery === 'function') agencyRenderGallery(agencia);
}

function cambiarSeccionAgencia(seccion, el){
  document.querySelectorAll('.agency-master-tab').forEach(btn => btn.classList.remove('active'));
  if(el) el.classList.add('active');
  document.querySelectorAll('.agency-section').forEach(section => {
    section.classList.toggle('active', section.dataset.section === seccion);
  });
  if(seccion === 'empleadas' && typeof agencyRenderEmpleadasTab === 'function') agencyRenderEmpleadasTab();
}

function guardarDetalleAgenciaCompleta(){
  if(agenciaDetalleActualIndex === null) return;
  const agencia = agencias[agenciaDetalleActualIndex];
  ensureAgencyDetailDefaults(agencia);
  agencia.numero = Number(document.getElementById('agencyFieldNumero').value || agencia.numero);
  agencia.nombre = `Agencia ${String(agencia.numero).padStart(4,'0')}`;
  const detalleGrupoSolicitado = document.getElementById('agencyFieldGrupo').value.trim() || getAgencyRealGroup(agencia);
  agencia.grupo = detalleGrupoSolicitado;
  agencia.encargado = document.getElementById('agencyFieldEncargado').value.trim() || agencia.encargado;
  agencia.direccion = document.getElementById('agencyFieldDireccion').value.trim();
  agencia.latitud = normalizarNumeroGeografico(document.getElementById('agencyFieldLatitud').value);
  agencia.longitud = normalizarNumeroGeografico(document.getElementById('agencyFieldLongitud').value);
  agencia.detalle.go = document.getElementById('agencyFieldGo').value.trim();
  agencia.detalle.ltk = document.getElementById('agencyFieldLtk').value.trim();
  agencia.detalle.telefono = document.getElementById('agencyFieldTelefono').value.trim();
  agencia.detalle.horario = document.getElementById('agencyFieldHorario').value.trim();
  agencia.detalle.estadoOperativo = normalizarEstadoAgencia(document.getElementById('agencyFieldEstadoOperativo').value);
  agencia.estadoOperativo = agencia.detalle.estadoOperativo;
  agencia.detalle.grupoReal = (detalleGrupoSolicitado !== AGENCY_SPECIAL_CLOSED_GROUP ? detalleGrupoSolicitado : (agencia.detalle.grupoReal || agencia.grupoReal || 'Grupo 00'));
  agencia.grupoReal = agencia.detalle.grupoReal;
  applyAgencyClosedStatusRule(agencia, detalleGrupoSolicitado);
  syncClosedAgenciesGroup();
  agencia.detalle.tipoAgencia = normalizarTipoAgencia(document.getElementById('agencyFieldTipoAgencia').value || 'Agencia');
  agencia.detalle.observacion = document.getElementById('agencyFieldObservacion').value.trim();
  agencia.detalle.estructura = {
    toldo: document.getElementById('agencyStructToldo').value,
    techo: document.getElementById('agencyStructTecho').value,
    pintura: document.getElementById('agencyStructPintura').value,
    piso: document.getElementById('agencyStructPiso').value,
    puerta: document.getElementById('agencyStructPuerta').value,
    counter: document.getElementById('agencyStructCounter').value,
    cliente: document.getElementById('agencyStructCliente').value,
    empleada: document.getElementById('agencyStructEmpleada').value,
    comentario: document.getElementById('agencyStructComentario').value.trim()
  };
  agencia.detalle.legal = {
    propietario: document.getElementById('agencyLegalPropietario').value.trim(),
    documento: document.getElementById('agencyLegalDocumento').value.trim(),
    telefono: document.getElementById('agencyLegalTelefono').value.trim(),
    estado: document.getElementById('agencyLegalEstado').value,
    inicio: document.getElementById('agencyLegalInicio').value,
    vencimiento: document.getElementById('agencyLegalVencimiento').value,
    observacion: document.getElementById('agencyLegalObservacion').value.trim()
  };
  agencia.detalle.permisos = {
    inventario: document.getElementById('agencyPermInventario').value,
    serializados: document.getElementById('agencyPermSerializados').value,
    soporte: document.getElementById('agencyPermSoporte').value,
    acceso: document.getElementById('agencyPermAcceso').value,
    movimientos: document.getElementById('agencyPermMovimientos').value,
    especial: document.getElementById('agencyPermEspecial').value
  };
  agencia.detalle.parametros = {
    tecnico: document.getElementById('agencyParamTecnico').value.trim(),
    supervisor: document.getElementById('agencyParamSupervisor').value.trim(),
    prioridad: document.getElementById('agencyParamPrioridad').value,
    canal: (document.getElementById('agencyParamCanal')?.value || 'Operaciones'),
    ruta: (document.getElementById('agencyParamRuta')?.value || '').trim(),
    horarioRuta: (document.getElementById('agencyParamHorario')?.value || '').trim(),
    ultimaVisita: document.getElementById('agencyParamUltimaVisita').value,
    proximaRevision: document.getElementById('agencyParamProximaRevision').value,
    nota: document.getElementById('agencyParamNota').value.trim()
  };
  if(agenciaPendienteSeriales.length > 0){
    const tiempo = obtenerFechaHoraActual();
    const referencia = `TR-AG-${String(secuenciaTransferencia).padStart(6,'0')}`;
    secuenciaTransferencia += 1;
    agenciaPendienteSeriales.forEach(item => {
      const almacen = almacenes[item.almacenIndex];
      const inventario = almacen?.inventario?.[item.inventarioIndex];
      if(!almacen || !inventario) return;
      const itemSerialKey = String(item.serial || '').toLowerCase();
      if(Array.isArray(inventario.seriales)) inventario.seriales = inventario.seriales.filter(s => String(s || '').toLowerCase() !== itemSerialKey);
      if(Array.isArray(inventario.series)) inventario.series = inventario.series.filter(s => String(s || '').toLowerCase() !== itemSerialKey);
      if(String(inventario.serial || '').toLowerCase() === itemSerialKey) inventario.serial = Array.isArray(inventario.seriales) && inventario.seriales.length === 1 ? inventario.seriales[0] : '';
      const remainingSerials = [];
      if(inventario.serial) remainingSerials.push(inventario.serial);
      if(Array.isArray(inventario.seriales)) remainingSerials.push(...inventario.seriales);
      if(Array.isArray(inventario.series)) remainingSerials.push(...inventario.series);
      inventario.cantidad = remainingSerials.length ? [...new Set(remainingSerials.map(String))].length : Math.max(0, Number(inventario.cantidad || 0) - 1);
      if(inventario.cantidad === 0) almacen.inventario.splice(item.inventarioIndex, 1);
      /*
  CAPA 2 / PASO 3C:
  Mutación local legacy neutralizada.
  No crear equipos locales en agencia.equipos.
  La ficha técnica real viene desde Supabase/equipos_seriales.
*/
try{
  if(typeof window.lotekaRenderAgenciaInventarioRealV141 === 'function'){
    setTimeout(function(){ window.lotekaRenderAgenciaInventarioRealV141(); }, 0);
  }
}catch(e){}
      registrarMovimientoAlmacen(item.almacenIndex,'Transferencia a agencia',referencia,`${item.producto} serial ${item.serial} enviado a ${agencia.nombre}`,usuarioMovimientoFijo,tiempo,referencia);
    });
    const origenes = [...new Set(agenciaPendienteSeriales.map(i => i.almacenNombre))];
    transferenciasInventario.unshift({
      codigo: referencia,
      origen: origenes.length === 1 ? origenes[0] : 'Múltiples almacenes',
      destino: agencia.nombre,
      producto: agenciaPendienteSeriales.length === 1 ? agenciaPendienteSeriales[0].producto : `${agenciaPendienteSeriales[0].producto} (+${agenciaPendienteSeriales.length - 1})`,
      productosResumen: agenciaPendienteSeriales.map(i => `${i.producto} [${i.serial}]`).join(', '),
      unidades: agenciaPendienteSeriales.length,
      fecha: tiempo.fecha,
      hora: tiempo.hora,
      fechaHora: tiempo.fechaHora,
      fechaISO: `${tiempo.fecha.split('-')[2]}-${tiempo.fecha.split('-')[1]}-${tiempo.fecha.split('-')[0]}`,
      usuario: usuarioMovimientoFijo,
      estado: 'Completada',
      serializado: 'si',
      observacion: `Transferencia rápida a ${agencia.nombre}`,
      items: agenciaPendienteSeriales.map(i => ({producto:i.producto,marca:i.marca,modelo:i.modelo,categoria:i.categoria,cantidad:1,serializado:'si',seriales:[i.serial]}))
    });
    agenciaPendienteSeriales = [];
    renderAlmacenes();
    llenarSelectsTransferencia();
    renderTransferencias();
  }
  agencias.sort((a,b)=>Number(a.numero)-Number(b.numero));
  renderAgencias();
  alert('Expediente de agencia actualizado correctamente');
  verDetalleAgencia(agencias.findIndex(a => Number(a.numero) === Number(agencia.numero)));
}


function verDetalleAgencia(i){
  const index = Number(i);
  const agencia = agencias[index];
  if(!Number.isInteger(index) || !agencia){
    alert('No se pudo abrir el detalle de la agencia.');
    return;
  }
  agenciaDetalleActualIndex = index;
  agenciaTabActual = 'equipos';
  agenciaPendienteSeriales = [];
  ensureAgencyDetailDefaults(agencia);

  const modal = document.getElementById('modalDetalleAgencia');
  if(modal) modal.style.display = 'flex';

  agencySetText('detalleAgenciaTitulo', 'Consulta y edición de Agencia');
  agencySetText('detalleAgenciaNombre', agencia.nombre || `Agencia ${String(agencia.numero || '').padStart(4,'0')}`);
  agencySetText('detalleAgenciaEncargadoChip', agencia.encargado || 'Sin encargado');
  agencySetText('detalleAgenciaGrupoCodigo', agenciaMapGroupValue(agencia) || '-');
  agencySetText('detalleAgenciaGoCodigo', agencia.detalle?.go || '-');
  agencySetText('detalleAgenciaLtkCodigo', agencia.detalle?.ltk || '-');
  agencySetText('detalleAgenciaSub', `${agenciaMapGroupValue(agencia) || '-'} · Grupo real: ${getAgencyRealGroup(agencia) || '-'} · Encargado: ${agencia.encargado || 'Sin encargado'}`);
  agencySetText('detalleAgenciaEquipos', Array.isArray(agencia.equipos) ? agencia.equipos.length : 0);
  agencySetText('detalleAgenciaSeriales', Array.isArray(agencia.equipos) ? agencia.equipos.filter(item => item.serial).length : 0);
  agencySetText('detalleAgenciaCamaras', Array.isArray(agencia.equipos) ? agencia.equipos.filter(item => item.categoria === 'camara').length : 0);
  agencySetText('detalleAgenciaRouters', Array.isArray(agencia.equipos) ? agencia.equipos.filter(item => item.categoria === 'routers').length : 0);
  agencySetHref('detalleAgenciaMapLink', typeof buildAgencyMapsSearchUrl === 'function' ? buildAgencyMapsSearchUrl(agencia) : '#');
  agencySetHref('detalleAgenciaRouteLink', typeof buildAgencyMapsDirectionsUrl === 'function' ? buildAgencyMapsDirectionsUrl(agencia) : '#');
  agencySetValue('buscarSerialAgencia', '');

  document.querySelectorAll('.agency-tab').forEach((btn, idx) => btn.classList.toggle('active', idx === 0));
  document.querySelectorAll('.agency-master-tab').forEach(btn => btn.classList.remove('active'));
  const firstMaster = document.querySelector('.agency-master-tab');
  if(firstMaster) firstMaster.classList.add('active');
  document.querySelectorAll('.agency-section').forEach(section => {
    section.classList.toggle('active', section.dataset.section === 'general');
  });

  try { cargarFormularioDetalleAgencia(agencia); } catch(err) { console.error('Error cargando formulario de agencia', err); }
  try { if(typeof renderDetalleAgenciaInventario === 'function') renderDetalleAgenciaInventario(); } catch(err) { console.error('Error renderizando inventario de agencia', err); }
  try { if(typeof agencyRenderEmpleadasTab === 'function') agencyRenderEmpleadasTab(); } catch(err) { console.error('Error renderizando empleadas de agencia', err); }
}

function cerrarDetalleAgencia(){
  agenciaPendienteSeriales = [];
  const input = document.getElementById('buscarSerialAgencia');
  if(input) input.value = '';
  document.getElementById('modalDetalleAgencia').style.display = 'none';
}

function cambiarTabAgencia(tab, el){
  agenciaTabActual = tab;
  document.querySelectorAll('.agency-tab').forEach(btn => btn.classList.remove('active'));
  if(el) el.classList.add('active');
  renderDetalleAgenciaInventario();
}

function obtenerCategoriaAgenciaDesdeInventario(categoria = '', producto = ''){
  const cat = String(categoria || '').toLowerCase();
  const prod = String(producto || '').toLowerCase();
  if(cat.includes('cam')) return 'camara';
  if(cat.includes('router') || prod.includes('router')) return 'routers';
  if(cat.includes('elect') || prod.includes('ups') || prod.includes('inversor') || prod.includes('bater')) return 'electricos';
  if(cat.includes('equipo')) return 'equipos';
  return 'adicional';
}

function obtenerImagenProducto(nombre, marca, modelo){
  const match = productos.find(p =>
    String(p.nombre||'').toLowerCase() === String(nombre||'').toLowerCase() &&
    String(p.marca||'').toLowerCase() === String(marca||'').toLowerCase() &&
    String(p.modelo||'').toLowerCase() === String(modelo||'').toLowerCase()
  ) || productos.find(p => String(p.nombre||'').toLowerCase() === String(nombre||'').toLowerCase());
  return match?.imagen || 'https://cdn-icons-png.flaticon.com/512/1829/1829586.png';
}

function activarTabAgencia(tab){
  agenciaTabActual = tab;
  document.querySelectorAll('.agency-tab').forEach(btn => {
    const texto = btn.innerText.toLowerCase();
    const esperado = tab === 'camara' ? 'cámara' : tab === 'electricos' ? 'eléctricos' : tab;
    btn.classList.toggle('active', texto.includes(esperado));
  });
  renderDetalleAgenciaInventario();
}

function agregarSerialRapidoAgencia(){
  if(agenciaDetalleActualIndex === null) return;
  const input = document.getElementById('buscarSerialAgencia');
  const serialBuscado = String(input?.value || '').trim();
  if(!serialBuscado){
    alert('Escribe o pega un serial');
    return;
  }
  const serialKey = serialBuscado.toLowerCase();
  const agencia = agencias[agenciaDetalleActualIndex];

  if(agencia.equipos.some(item => String(item.serial||'').toLowerCase() === serialKey) || agenciaPendienteSeriales.some(item => String(item.serial||'').toLowerCase() === serialKey)){
    alert('Ese serial ya existe o ya fue agregado a esta agencia');
    return;
  }

  let encontrado = null;
  almacenes.forEach((almacen, almacenIndex) => {
    if(encontrado) return;
    (almacen.inventario || []).forEach((inv, inventarioIndex) => {
      if(encontrado) return;
      const seriales = [];
      if(inv.serial) seriales.push(inv.serial);
      if(Array.isArray(inv.seriales)) seriales.push(...inv.seriales);
      if(Array.isArray(inv.series)) seriales.push(...inv.series);
      const serialReal = seriales.find(s => String(s || '').toLowerCase() === serialKey);
      if(serialReal){
        encontrado = { almacenIndex, inventarioIndex, almacenNombre: almacen.nombre, inv, serial: serialReal };
      }
    });
  });

  if(!encontrado){
    alert('No se encontró ese serial en ningún almacén');
    return;
  }

  const item = {
    id: `tmp-${Date.now()}-${Math.random().toString(16).slice(2,7)}`,
    categoria: obtenerCategoriaAgenciaDesdeInventario(encontrado.inv.categoria, encontrado.inv.producto),
    producto: encontrado.inv.producto,
    imagen: obtenerImagenProducto(encontrado.inv.producto, encontrado.inv.marca, encontrado.inv.modelo),
    marca: encontrado.inv.marca,
    modelo: encontrado.inv.modelo,
    serial: encontrado.serial,
    fechaInstalacion: obtenerFechaHoy(),
    pending: true,
    almacenIndex: encontrado.almacenIndex,
    almacenNombre: encontrado.almacenNombre,
    inventarioIndex: encontrado.inventarioIndex
  };

  agenciaPendienteSeriales.push(item);
  input.value = '';
  activarTabAgencia(item.categoria);
}

function guardarCambiosAgencia(){ guardarDetalleAgenciaCompleta(); }


function llenarMiniTransferenciaAlmacenes(){
  const select = document.getElementById('miniTransferAlmacen');
  if(!select) return;
  select.innerHTML = '<option value="">Selecciona un almacén</option>';
  almacenes.forEach((almacen, index) => {
    select.innerHTML += `<option value="${index}">${almacen.nombre}</option>`;
  });
}

function abrirMiniTransferenciaAgencia(itemId){
  if(agenciaDetalleActualIndex === null) return;
  const agencia = agencias[agenciaDetalleActualIndex];
  const item = agencia.equipos.find(eq => String(eq.id) === String(itemId));
  if(!item){
    alert('No se encontró el producto seleccionado');
    return;
  }
  agenciaTransferItemId = item.id;
  llenarMiniTransferenciaAlmacenes();
  document.getElementById('miniTransferProducto').value = `${item.producto} - ${item.marca} - ${item.modelo}`;
  document.getElementById('miniTransferSerial').value = item.serial || '';
  document.getElementById('miniTransferAlmacen').value = '';
  document.getElementById('miniTransferComentario').value = '';
  document.getElementById('modalMiniTransferenciaAgencia').style.display = 'flex';
}

function cerrarMiniTransferenciaAgencia(){
  agenciaTransferItemId = null;
  const modal = document.getElementById('modalMiniTransferenciaAgencia');
  if(modal) modal.style.display = 'none';
}

function confirmarMiniTransferenciaAgencia(){
  if(agenciaDetalleActualIndex === null || !agenciaTransferItemId) return;
  const agencia = agencias[agenciaDetalleActualIndex];
  const almacenIndexValue = document.getElementById('miniTransferAlmacen').value;
  const comentario = document.getElementById('miniTransferComentario').value.trim();

  if(almacenIndexValue === ''){
    alert('Selecciona el almacén destino');
    return;
  }

  const itemIndex = agencia.equipos.findIndex(eq => String(eq.id) === String(agenciaTransferItemId));
  if(itemIndex === -1){
    alert('No se encontró el producto en la agencia');
    return;
  }

  const confirmar = confirm('¿Estás seguro de realizar este movimiento?');
  if(!confirmar) return;

  const almacenIndex = Number(almacenIndexValue);
  const almacen = almacenes[almacenIndex];
  const item = agencia.equipos[itemIndex];
  const tiempo = obtenerFechaHoraActual();
  const referencia = `TR-AG-${String(secuenciaTransferencia).padStart(6,'0')}`;
  secuenciaTransferencia += 1;

  let inventarioExistente = (almacen.inventario || []).find(inv =>
    String(inv.producto||'').toLowerCase() === String(item.producto||'').toLowerCase() &&
    String(inv.marca||'').toLowerCase() === String(item.marca||'').toLowerCase() &&
    String(inv.modelo||'').toLowerCase() === String(item.modelo||'').toLowerCase()
  );

  if(inventarioExistente){
    inventarioExistente.cantidad = Number(inventarioExistente.cantidad || 0) + 1;
    inventarioExistente.tipo = 'Serializado';
    if(!Array.isArray(inventarioExistente.seriales)) inventarioExistente.seriales = [];
    if(item.serial) inventarioExistente.seriales.push(item.serial);
  } else {
    almacen.inventario.push({
      producto: item.producto,
      marca: item.marca,
      modelo: item.modelo,
      categoria: item.categoria,
      cantidad: 1,
      tipo: 'Serializado',
      seriales: item.serial ? [item.serial] : []
    });
  }

  /*
  CAPA 2 / PASO 3E:
  Mutación local legacy neutralizada.
  No eliminar equipos desde agencia.equipos.
  La salida real de ficha técnica debe venir desde Supabase/equipos_seriales.
*/
try{
  if(typeof window.lotekaRenderAgenciaInventarioRealV141 === 'function'){
    setTimeout(function(){ window.lotekaRenderAgenciaInventarioRealV141(); }, 0);
  }
}catch(e){}

  registrarMovimientoAlmacen(
    almacenIndex,
    'Transferencia desde agencia',
    referencia,
    comentario || `${item.producto} serial ${item.serial} recibido desde ${agencia.nombre}`,
    usuarioMovimientoFijo,
    tiempo,
    referencia
  );

  transferenciasInventario.unshift({
    codigo: referencia,
    origen: agencia.nombre,
    destino: almacen.nombre,
    producto: item.producto,
    productosResumen: `${item.producto} [${item.serial || 'Sin serial'}]`,
    unidades: 1,
    fecha: tiempo.fecha,
    hora: tiempo.hora,
    fechaHora: tiempo.fechaHora,
    fechaISO: `${tiempo.fecha.split('-')[2]}-${tiempo.fecha.split('-')[1]}-${tiempo.fecha.split('-')[0]}`,
    usuario: usuarioMovimientoFijo,
    estado: 'Completada',
    serializado: item.serial ? 'si' : 'no',
    observacion: comentario || `Transferencia rápida desde ${agencia.nombre}`,
    items: [{
      producto: item.producto,
      marca: item.marca,
      modelo: item.modelo,
      categoria: item.categoria,
      cantidad: 1,
      serializado: item.serial ? 'si' : 'no',
      seriales: item.serial ? [item.serial] : []
    }]
  });

  cerrarMiniTransferenciaAgencia();
  renderAgencias();
  renderAlmacenes();
  llenarSelectsTransferencia();
  renderTransferencias();
  verDetalleAgencia(agenciaDetalleActualIndex);
}

function renderDetalleAgenciaInventario(){
  if(agenciaDetalleActualIndex === null) return;
  const agencia = agencias[agenciaDetalleActualIndex];
  const tbody = document.getElementById('detalleAgenciaInventarioBody');

/*
  CAPA 2 / PASO 2B:
  Evitamos que el render legacy basado en agencia.equipos/agenciaPendienteSeriales
  pise la ficha técnica real de Supabase.

  Si existe el render real v141, delegamos hacia él.
*/
if(
  typeof window.lotekaRenderAgenciaInventarioRealV141 === 'function' &&
  !window.__lotekaFichaTecnicaRenderLegacyGuard
){
  window.__lotekaFichaTecnicaRenderLegacyGuard = true;
  try{
    return window.lotekaRenderAgenciaInventarioRealV141();
  }catch(e){
    console.warn('[CAPA 2] No se pudo delegar ficha técnica al render real:', e && e.message ? e.message : e);
  }finally{
    setTimeout(function(){
      window.__lotekaFichaTecnicaRenderLegacyGuard = false;
    }, 0);
  }
}

let items = Array.isArray(agencia.equipos)
  ? agencia.equipos.filter(item => item.categoria === agenciaTabActual)
  : [];

const pendientes = Array.isArray(agenciaPendienteSeriales)
  ? agenciaPendienteSeriales.filter(item => item.categoria === agenciaTabActual)
  : [];

items = items.concat(pendientes);
  tbody.innerHTML = '';
  if(items.length === 0){
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:#8a8a8a;font-style:italic;font-weight:700;padding:24px">No hay equipos registrados en esta categoría.</td></tr>`;
    return;
  }
  items.forEach((item, idx) => {
    tbody.innerHTML += `
      <tr>
        <td>${idx + 1}</td>
        <td>${item.producto}${item.pending ? '<div style="margin-top:6px;font-size:11px;color:#2f8fe8;font-weight:800">Pendiente de guardar</div>' : ''}</td>
        <td><img class="agency-item-thumb" src="${item.imagen}" alt="${item.producto}"></td>
        <td>${item.marca}</td>
        <td>${item.modelo}</td>
        <td><span class="serial-chip">${item.serial}</span>${item.pending ? `<div style="margin-top:6px;font-size:11px;color:#6b7d8d">Desde ${item.almacenNombre}</div>` : ''}</td>
        <td>${item.fechaInstalacion}</td>
        <td class="actions">${item.pending ? '<i class="fas fa-clock" title="Pendiente"></i>' : `<i class="fas fa-right-left" title="Transferir a almacén" onclick="abrirMiniTransferenciaAgencia('${item.id}')"></i>`}</td>
      </tr>
    `;
  });
}


function renderGrupoAgenciasChecklist(seleccionadas = []){
  const box = document.getElementById('grupoAgenciasChecklist');
  if(!box) return;
  box.innerHTML = '';
  agencias.forEach(agencia => {
    const checked = seleccionadas.includes(agencia.numero) ? 'checked' : '';
    box.innerHTML += `
      <label class="group-agency-item">
        <span class="group-agency-check">
          <input type="checkbox" class="grupo-agencia-check" value="${agencia.numero}" ${checked}>
          <span>${agencia.nombre}</span>
        </span>
        <span style="color:#7c8d9d;font-weight:700">${agencia.grupo}</span>
      </label>
    `;
  });
}

function abrirModalGrupo(){
  editGrupoIndex = null;
  document.getElementById('tituloModalGrupo').innerText = 'Crear Grupo';
  document.getElementById('grupoNumero').value = '';
  document.getElementById('grupoEncargado').value = '';
  document.getElementById('grupoColor').value = '#f0c243';
  document.getElementById('grupoFlota').value = '';
  document.getElementById('grupoExtension').value = '';
  document.getElementById('grupoCorreo').value = '';
  renderGrupoAgenciasChecklist([]);
  document.getElementById('modalGrupo').style.display = 'flex';
}

function cerrarModalGrupo(){
  document.getElementById('modalGrupo').style.display = 'none';
}

function editarGrupo(i){
  const grupo = grupos[i];
  editGrupoIndex = i;
  document.getElementById('tituloModalGrupo').innerText = 'Editar Grupo';
  document.getElementById('grupoNumero').value = grupo.numero;
  document.getElementById('grupoEncargado').value = grupo.encargado;
  document.getElementById('grupoColor').value = grupo.color || '#f0c243';
  document.getElementById('grupoFlota').value = grupo.flota || '';
  document.getElementById('grupoExtension').value = grupo.extension || '';
  document.getElementById('grupoCorreo').value = grupo.correo || '';
  renderGrupoAgenciasChecklist(grupo.agencias || []);
  document.getElementById('modalGrupo').style.display = 'flex';
}

function guardarGrupo(){
  const numero = document.getElementById('grupoNumero').value.trim();
  const encargado = document.getElementById('grupoEncargado').value.trim();
  const color = document.getElementById('grupoColor').value || '#f0c243';
  const flota = document.getElementById('grupoFlota').value.trim();
  const extension = document.getElementById('grupoExtension').value.trim();
  const correo = document.getElementById('grupoCorreo').value.trim();
  const agenciasSeleccionadas = Array.from(document.querySelectorAll('.grupo-agencia-check:checked')).map(el => Number(el.value));

  if(!numero){
    alert('Escribe el número del grupo');
    return;
  }
  if(!encargado){
    alert('Escribe el encargado del grupo');
    return;
  }

  const nombre = numero.toLowerCase().includes('grupo') ? numero : `Grupo ${numero}`;
  const data = {
    numero: numero.replace(/Grupo\s*/i, ''),
    nombre,
    color,
    encargado,
    flota,
    extension,
    correo,
    custodia: editGrupoIndex === null ? [] : (grupos[editGrupoIndex].custodia || []),
    agencias: agenciasSeleccionadas
  };

  if(editGrupoIndex === null){
    grupos.push(data);
  }else{
    grupos[editGrupoIndex] = data;
  }

  agencias.forEach(agencia => {
    if(agenciasSeleccionadas.includes(agencia.numero)){
      if(!agencia.detalle) agencia.detalle = {};
      if(getAgencyEstadoOperativo(agencia) === 'DESACTIVADA/CERRADA'){
        agencia.detalle.grupoReal = nombre;
        agencia.grupoReal = nombre;
        agencia.grupo = AGENCY_SPECIAL_CLOSED_GROUP;
      }else{
        agencia.grupo = nombre;
        agencia.detalle.grupoReal = nombre;
        agencia.grupoReal = nombre;
      }
      agencia.encargado = encargado;
    }
  });
  syncClosedAgenciesGroup();

  renderAgencias();
  renderGrupos();
  cerrarModalGrupo();
}


function lotekaGroupNorm(value){
  return String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
}
function lotekaPopulateGroupFilters(){
  const select = document.getElementById('groupManagerFilter');
  if(!select) return;
  const current = select.value;
  const managers = [...new Set((grupos || []).map(g => (g.encargado || '').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
  select.innerHTML = '<option value="">Todos</option>' + managers.map(m => `<option value="${m}">${m}</option>`).join('');
  if(managers.includes(current)) select.value = current;
}
function lotekaClearGroupFilters(){
  const search = document.getElementById('groupSearchInput');
  const manager = document.getElementById('groupManagerFilter');
  if(search) search.value = '';
  if(manager) manager.value = '';
  renderGrupos();
}
function lotekaGroupLabel(name){
  const raw = String(name || '').trim();
  if(!raw) return 'Grupo';
  if(/^grupo\s+/i.test(raw)) return raw.replace(/^grupo/i,'Grupo');
  const digits = raw.replace(/[^0-9]/g,'');
  return digits ? `Grupo ${digits.padStart(2,'0')}` : raw;
}

function renderGrupos(){
  lotekaEnsureAgenciasGruposBase();
  const tbody = document.getElementById('tabla-grupos');
  if(!tbody) return;

  lotekaPopulateGroupFilters();

  const q = lotekaGroupNorm(document.getElementById('groupSearchInput')?.value || '');
  const managerFilter = lotekaGroupNorm(document.getElementById('groupManagerFilter')?.value || '');

  const catalog = window.LotekaCatalog || {};
  const allGroupsForView = (grupos || []).filter(grupo => typeof catalog.isGroupOperational === 'function' ? catalog.isGroupOperational(grupo) : true);
  const source = allGroupsForView.map((grupo) => {
    const i = (grupos || []).indexOf(grupo);
    const agenciasDelGrupo = agencias.filter(a => {
      const belongs = agenciaMapGroupValue(a) === grupo.nombre || (grupo.agencias || []).includes(a.numero);
      const active = typeof catalog.isAgencyActive === 'function' ? catalog.isAgencyActive(a) : true;
      return belongs && active;
    });
    grupo.agencias = agenciasDelGrupo.map(a => a.numero);
    const equiposCustodia = (grupo.custodia || []).length;
    const serialesActivos = (grupo.custodia || []).filter(item => item.serial).length;
    const searchable = lotekaGroupNorm([
      grupo.nombre,
      lotekaGroupLabel(grupo.nombre),
      grupo.encargado,
      grupo.flota,
      grupo.extension,
      grupo.correo,
      ...agenciasDelGrupo.map(a => `${a.numero} ${a.nombre} ${a.codigo || ''}`)
    ].join(' '));
    return { grupo, i, agenciasDelGrupo, equiposCustodia, serialesActivos, searchable };
  }).filter(item => {
    if(q && !item.searchable.includes(q)) return false;
    if(managerFilter && lotekaGroupNorm(item.grupo.encargado) !== managerFilter) return false;
    return true;
  });

  const rows = source.map(({grupo, i, agenciasDelGrupo, equiposCustodia, serialesActivos}) => `
      <tr>
        <td><span class="group-color-dot-v82" style="background:${grupo.color || '#f0c243'}"></span></td>
        <td><span class="group-name-chip"><i class="fas fa-layer-group"></i>${lotekaGroupLabel(grupo.nombre)}</span></td>
        <td><span class="group-manager-name">${grupo.encargado || '-'}</span></td>
        <td><span class="group-metric-pill">${agenciasDelGrupo.length}</span></td>
        <td><span class="group-metric-pill group-custody-pill">${equiposCustodia}</span></td>
        <td><span class="group-metric-pill group-serial-pill">${serialesActivos}</span></td>
        <td><div class="group-admin-actions-cell"><button class="group-action-btn" type="button" onclick="verDetalleGrupo(${i})" title="Consultar"><i class="fas fa-eye"></i></button><button class="group-action-btn" type="button" onclick="editarGrupo(${i})" title="Editar"><i class="fas fa-pen"></i></button></div></td>
      </tr>
    `);
  lotekaRenderPaginatedRows('tabla-grupos', rows, {colspan:7, emptyMessage:'No hay grupos registrados con esos filtros.', defaultPageSize:10});

  const canonicalStats = typeof catalog.stats === 'function' ? catalog.stats(agencias || [], grupos || []) : null;
  const totalGrupos = canonicalStats ? canonicalStats.operationalGroups : allGroupsForView.length;
  const totalAgencias = canonicalStats ? canonicalStats.activeAgencies : source.reduce((sum, item) => sum + item.agenciasDelGrupo.length, 0);
  const totalCustodia = (grupos || []).reduce((sum, grupo) => sum + ((grupo.custodia || []).length), 0);
  const setText = (id, value) => { const el = document.getElementById(id); if(el) el.innerText = value; };
  setText('dashTotalGrupos', totalGrupos);
  setText('dashAgenciasGrupos', totalAgencias);
  setText('dashCustodiaGrupos', totalCustodia);
}
function verDetalleGrupo(i){
  detalleGrupoActualIndex = i;
  const grupo = grupos[i];
  const agenciasDelGrupo = agencias.filter(a => agenciaMapGroupValue(a) === grupo.nombre || (grupo.agencias || []).includes(a.numero));

  document.getElementById('detalleGrupoTitulo').innerText = 'Detalle de grupo';
  document.getElementById('detalleGrupoNombre').innerText = grupo.nombre;
  document.getElementById('detalleGrupoEncargado').innerText = grupo.encargado || '-';
  document.getElementById('detalleGrupoFlota').innerText = grupo.flota || '-';
  document.getElementById('detalleGrupoExtension').innerText = grupo.extension || '-';
  document.getElementById('detalleGrupoCorreo').innerText = grupo.correo || '-';
  document.getElementById('detalleGrupoColor').style.background = grupo.color || '#f0c243';
  document.getElementById('detalleGrupoAgencias').innerText = agenciasDelGrupo.length;
  document.getElementById('detalleGrupoCustodia').innerText = (grupo.custodia || []).length;
  document.getElementById('detalleGrupoSeriales').innerText = (grupo.custodia || []).filter(item => item.serial).length;

  const agenciasList = document.getElementById('detalleGrupoAgenciasList');
  agenciasList.innerHTML = '';
  if(agenciasDelGrupo.length === 0){
    agenciasList.innerHTML = '<div class="group-empty">Este grupo no tiene agencias asignadas.</div>';
  }else{
    agenciasDelGrupo.forEach(agencia => {
      const numeroAgencia = lotekaAgencyLabelSolo(agencia);
      const grupoAgencia = lotekaGroupLabel(agenciaMapGroupValue(agencia) || agencia.grupo || grupo.nombre);
      agenciasList.innerHTML += `<span class="group-agency-chip"><i class="fas fa-store"></i><b>${lotekaAgencyAdminText(numeroAgencia)}</b><small>${lotekaAgencyAdminText(grupoAgencia)}</small></span>`;
    });
  }

  const tbody = document.getElementById('detalleGrupoCustodiaBody');
  tbody.innerHTML = '';
  if(!grupo.custodia || grupo.custodia.length === 0){
    tbody.innerHTML = '<tr><td colspan="3" class="group-empty">No hay inventario en custodia para este grupo.</td></tr>';
  }else{
    grupo.custodia.forEach(item => {
      tbody.innerHTML += `<tr><td>${item.producto}</td><td>${item.serial || '-'}</td><td>${item.fecha || '-'}</td></tr>`;
    });
  }

  document.getElementById('modalDetalleGrupo').style.display = 'flex';
}

function cerrarDetalleGrupo(){
  document.getElementById('modalDetalleGrupo').style.display = 'none';
}



function agregarSerialRapidoGrupo(){
  if(detalleGrupoActualIndex === null){
    alert('Abre un grupo primero');
    return;
  }
  const serial = document.getElementById('grupoSerialRapido').value.trim();
  if(!serial){
    alert('Escribe un serial');
    return;
  }

  const grupoDestino = grupos[detalleGrupoActualIndex];
  let encontrado = null;
  let origenTipo = '';
  let origenNombre = '';
  let origenIndex = -1;

  almacenes.forEach((almacen, idx) => {
    (almacen.inventario || []).forEach(item => {
      if(encontrado) return;
      if(item.serial === serial){
        encontrado = {...item};
        origenTipo = 'almacen';
        origenNombre = almacen.nombre;
        origenIndex = idx;
      }else if(Array.isArray(item.seriales) && item.seriales.includes(serial)){
        encontrado = {
          producto:item.producto,
          marca:item.marca,
          modelo:item.modelo,
          categoria:item.categoria,
          imagen:item.imagen || '',
          serial,
          fechaInstalacion:obtenerFechaHoraActual().fecha,
          cantidad:1,
          tipo:'Serializado',
          id:`temp-${serial}`
        };
        origenTipo = 'almacen';
        origenNombre = almacen.nombre;
        origenIndex = idx;
      }
    });
  });

  agencias.forEach((agencia, idx) => {
    (agencia.equipos || []).forEach(item => {
      if(encontrado) return;
      if(item.serial === serial){
        encontrado = {...item};
        origenTipo = 'agencia';
        origenNombre = agencia.nombre;
        origenIndex = idx;
      }
    });
  });

  grupos.forEach((grupo, idx) => {
    (grupo.custodia || []).forEach(item => {
      if(encontrado) return;
      if(item.serial === serial){
        encontrado = {...item};
        origenTipo = 'grupo';
        origenNombre = grupo.nombre;
        origenIndex = idx;
      }
    });
  });

  if(!encontrado){
    alert('No se encontró ese serial en el sistema');
    return;
  }

  if(origenTipo === 'grupo' && origenIndex === detalleGrupoActualIndex){
    alert('Ese serial ya pertenece a este grupo');
    return;
  }

  const yaExiste = (grupoDestino.custodia || []).some(item => item.serial === serial);
  if(yaExiste){
    alert('Ese serial ya está en el grupo');
    return;
  }

  const confirmar = confirm(`¿Mover este serial a ${grupoDestino.nombre} desde ${origenNombre}?`);
  if(!confirmar) return;

  const tiempo = obtenerFechaHoraActual();
  const referencia = `TR-GR-${String(Date.now()).slice(-6)}`;

  if(origenTipo === 'almacen'){
    const inventario = almacenes[origenIndex].inventario || [];
    const idx = inventario.findIndex(item => item.serial === serial);
    if(idx > -1){
      inventario.splice(idx, 1);
    }else{
      inventario.forEach((item, invIndex) => {
        if(Array.isArray(item.seriales) && item.seriales.includes(serial)){
          item.seriales = item.seriales.filter(s => s !== serial);
          item.cantidad = Number(item.cantidad || 0) - 1;
          if(item.cantidad <= 0){
            inventario.splice(invIndex, 1);
          }
        }
      });
    }
    registrarMovimientoAlmacen(origenIndex, 'Transferencia salida', referencia, `${encontrado.producto} serial ${serial} enviado a ${grupoDestino.nombre}`, usuarioMovimientoFijo, tiempo, referencia);
  } else if(origenTipo === 'agencia'){
    const equipos = agencias[origenIndex].equipos || [];
    const idx = equipos.findIndex(item => item.serial === serial);
    if(idx > -1) equipos.splice(idx, 1);
  } else if(origenTipo === 'grupo'){
    const custodia = grupos[origenIndex].custodia || [];
    const idx = custodia.findIndex(item => item.serial === serial);
    if(idx > -1) custodia.splice(idx, 1);
  }

  grupoDestino.custodia = grupoDestino.custodia || [];
  grupoDestino.custodia.push({
    producto: encontrado.producto,
    marca: encontrado.marca,
    modelo: encontrado.modelo,
    categoria: encontrado.categoria,
    imagen: encontrado.imagen || '',
    serial,
    fecha: tiempo.fecha,
    fechaInstalacion: tiempo.fecha,
    cantidad: 1,
    tipo: 'Serializado',
    id: `GR-${grupoDestino.numero}-${serial}`
  });

  transferenciasInventario.unshift({
    codigo: referencia,
    origen: origenNombre,
    destino: grupoDestino.nombre,
    producto: encontrado.producto,
    productosResumen: `${encontrado.producto} (1)`,
    unidades: 1,
    fecha: tiempo.fecha,
    hora: tiempo.hora,
    fechaHora: tiempo.fechaHora,
    fechaVista: tiempo.fechaHora,
    fechaISO: `${tiempo.fecha.split('-')[2]}-${tiempo.fecha.split('-')[1]}-${tiempo.fecha.split('-')[0]}`,
    usuario: usuarioMovimientoFijo,
    estado: 'Completada',
    observacion: `Transferencia rápida por serial a ${grupoDestino.nombre}`,
    items: [{
      producto: encontrado.producto,
      marca: encontrado.marca,
      modelo: encontrado.modelo,
      categoria: encontrado.categoria,
      cantidad: 1,
      serializado: 'si',
      seriales: [serial],
      imagen: encontrado.imagen || ''
    }],
    tipoTransferencia: `${nombreTipoEntidad(origenTipo)} a Grupo`
  });

  document.getElementById('grupoSerialRapido').value = '';
  renderAlmacenes();
  renderAgencias();
  renderGrupos();
  renderTransferencias();
  verDetalleGrupo(detalleGrupoActualIndex);
}

renderProductos();
renderAlmacenes();
lotekaEnsureAgenciasGruposBase();
renderAgencias();
renderGrupos();
llenarFiltrosEntrada();
llenarSelectsTransferencia();
renderEntradas();
renderTransferencias();
