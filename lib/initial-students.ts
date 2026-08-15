import type { StudentRecord } from "@/lib/student-utils"
import { parseFullName, sortStudents } from "@/lib/student-utils"
import {
  DEFAULT_PARALLEL,
  FIRST_BT_PARALLEL,
  SECOND_BT_PARALLEL,
  SECOND_PARALLEL,
  THIRD_BT_PARALLEL,
  THIRD_PARALLEL,
  getSubjectsForParallel,
} from "@/lib/subjects"

const FIRST_YEAR_NAMES = [
  "Bautista Manzaba Neythan Enrique",
  "Bone Gonzalez Graciela Kayori",
  "Chalar Mendez Alexa Girabel",
  "Corozo Vasquez Isabel Valeska",
  "De La Cruz Preciado Yoryi Danilo",
  "De La Cruz Quintero Edita Mirely",
  "Escobar Cetre Brithany Pauletth",
  "Hernandez Proaño Dania Saray",
  "López Ortiz Josue Isaías",
  "Mendez Quiñonez Cristhian Andres",
  "Mendoza Parraga Eliab Isai",
  "Mojarrango Garcia Damaris Maytte",
  "Ordoñez Bone Karen Ximena",
  "Ortiz Simisterra Carlos Jahdiel",
  "Perea Ortiz Rode Danel",
  "Rios Mosquera Danahis Jacqueline",
  "Rodriguez Tenorio Jeykol Geovanny",
  "Tortez Medina Arnulfo Genaro",
  "Vernaza Arroyo Suany Bielka",
] as const

const SECOND_YEAR_NAMES = [
  "ALCIVAR MERA BRIANA JASSEL",
  "ALTAFUYA MEDINA CRISTEL MADELAY",
  "ARIAS ROSERO JEFFREY ESTEFFANO",
  "CABEZAS VILLAQUIRAN MARCELO EMMANUEL",
  "CARRANZA ESTRADA ALEJANDRO EDWIN",
  "CHARCOPA MENDEZ NAILA LISBETH",
  "COX CHEME JUAN DAVID",
  "GUTIERREZ RAMIREZ RICARDO",
  "JAEN CHAVEZ JORDY ELIAN",
  "JAMA CHAVEZ IVAN ANDRES",
  "LOPEZ ORTIZ MICHAEL JESUS",
  "MERA GONZALEZ KARLA LEIZABETH",
  "MEZA ALOMIA SANTIAGO SAID",
  "MONTAÑO TOALA STEVEN ANDRES",
  "ORTIZ REYES GEOVANNY ALEXANDER",
  "PARRAGA VALENCIA CEILA ANALIA",
  "PERDOMO MENDEZ DYLAN ABRAHAM",
  "PRECIADO AMARI PAULA DAHIZE",
  "SANCHEZ CAICEDO GEOVANNY ISAIAS",
  "SOLIS MARIN DIDIER MATEO",
  "TANAI GONZALEZ EDGAR ISAAC",
  "VERA MACIAS ELIEL EZEQUIEL",
] as const

const FIRST_BT_NAMES = [
  "ABAD RIVERA ANDY ISRAEL",
  "ALDANA PAEZ KERLYZ VALENTINA",
  "AYOVI VERNAZA IKER NEYMAR",
  "CAICEDO JIJON YORLYN JUSSEPY",
  "CORDOVA MERO KRISTHEL BIANKA",
  "CUERO QUIÑONEZ GABRIEL STEFANO",
  "GARCIA SANCHEZ FRANCISCO ALBIERI",
  "IBARRA SEGURA JARHELL JEFFREE",
  "LOPEZ ORTIZ JOSUE ISAIAS",
  "MEZA ALOMIA DENIS JANIER",
  "MORALES PLAZA ANGEL PATRICIO",
  "NEIRA JACOME SHENOA THAIS",
  "PARRAGA JURADO THIAGO EMANUEL",
  "SAMANIEGO BONE DUBRASKA PATRICIA",
  "SOLANO CABEZA RUTH BETANIA",
  "TREJO NAPA JORDANA BRISLEY",
  "VALENCIA CHERREZ SOFIA DANIELA",
] as const

const SECOND_BT_NAMES = [
  "BEJARANO VALDIVIEZO ISAAC SEBASTIAN",
  "CEBALLOS CORTEZ GUSSEPPE YESHIEL",
  "CHILA ZAMBRANO PAMELA JAQUELINE",
  "ESCOBAR MORENO ALEJANDRO MATIAS",
  "GARCIA CHAVEZ RONNY JHAIR",
  "GEORGE GONZALEZ DIDIER ALEXANDER",
  "GONZALEZ MARQUEZ WASHINGTON ISRAEL",
  "GONZALEZ SEVILLA CARLOS ALEJANDRO",
  "MARQUEZ BASTIDA HILLARY MAITTE",
  "NICOLA DELGADO PATRICK AARON",
  "PILAMUNGA SUMI JHOEL FARID",
  "TREJO CORTEZ OLGER EDDIER",
  "VALENCIA PINTO ANA VALERIA",
  "VERGARA FREIRE DAYANNA NAOMI",
] as const

const THIRD_BT_NAMES = [
  "BRAVO ORELLANA DAINELYS ISAMAR",
  "CANGA OCHOA BRUNO ISAAC",
  "CASTILLO CABEZA MATEO ISRRAEL",
  "CASTRO QUIÑONEZ RUTH ANALIA",
  "COX CHEME CALEB OSIAS",
  "HERNANDEZ PROAÑO SCARLET LICETT",
  "MERO CHAVEZ DANIELA VANESSA",
  "MINA GARCIA JORGE SAMUEL",
  "PRECIADO VASQUEZ RAFAEL ALFONSO",
  "RAMOS PALOMINO JOSTYN ALEXANDER",
  "TACO HENRIQUEZ DOMENICA JAMELA",
] as const

const THIRD_YEAR_NAMES = [
  "ASTUDILLO ESCOBAR SUSANA ENRIQUETA",
  "BONAGA MENDOZA MARIA ELENA",
  "CAICEDO ZAMBRANO BETTY JAMILETH",
  "CASTILLO ARAUJO IVAN DANIEL",
  "CONTRERA MOSQUERA MARIELA ANAHELA",
  "ESTUPIÑAN RODRIGUEZ GABRIEL ALEJANDRO",
  "GAMEZ GONGORA ISAI DANIEL",
  "LOPEZ ANDRADE DARIO ALEXANDER",
  "NAZARENO BORJA JOSELYN JUMALAY",
  "NEIRA JACOME ALEXANDRA NICOLE",
  "OLMEDO RUANO JOHAN ALEXANDER",
  "PERERO RENTERIA ADONIS RUBEN",
  "SALAZAR CUELLAR JOSE LUIS",
  "TOALA MUENTES NELSON ESNAIDER",
  "VERA MARIN NOBELTIS NATASHA",
  "VIDAL RENGIFO SUSAN ELIANA",
] as const

function buildStudent(
  fullName: string,
  index: number,
  parallel: string,
  idPrefix: string
): StudentRecord {
  const { surnames, givenNames } = parseFullName(fullName)

  return {
    id: `${idPrefix}-${index + 1}`,
    surnames,
    givenNames,
    subjects: getSubjectsForParallel(parallel),
    parallel,
    whatsappNumber: "",
    parentPhone: "",
    studentPhone: "",
    parentName: `Representante ${surnames.split(" ")[0]}`,
  }
}

export function createInitialStudents(): StudentRecord[] {
  const firstYear = FIRST_YEAR_NAMES.map((fullName, index) =>
    buildStudent(fullName, index, DEFAULT_PARALLEL, "init-1ro")
  )

  const secondYear = SECOND_YEAR_NAMES.map((fullName, index) =>
    buildStudent(fullName, index, SECOND_PARALLEL, "init-2do")
  )

  const thirdYear = THIRD_YEAR_NAMES.map((fullName, index) =>
    buildStudent(fullName, index, THIRD_PARALLEL, "init-3ro")
  )

  const firstBt = FIRST_BT_NAMES.map((fullName, index) =>
    buildStudent(fullName, index, FIRST_BT_PARALLEL, "init-1ro-bt")
  )

  const secondBt = SECOND_BT_NAMES.map((fullName, index) =>
    buildStudent(fullName, index, SECOND_BT_PARALLEL, "init-2do-bt")
  )

  const thirdBt = THIRD_BT_NAMES.map((fullName, index) =>
    buildStudent(fullName, index, THIRD_BT_PARALLEL, "init-3ro-bt")
  )

  return sortStudents([
    ...firstYear,
    ...firstBt,
    ...secondYear,
    ...secondBt,
    ...thirdYear,
    ...thirdBt,
  ])
}

export function createStudentId() {
  return `student-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

export function createFictionalWhatsApp() {
  const suffix = Math.floor(100000 + Math.random() * 900000)
  return `59399${suffix}`
}
