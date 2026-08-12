import ExcelJS from 'exceljs';
import {
  addListValidation,
  buildInstructionsSheet,
  buildListsSheet,
  styleHeaderRow,
} from '@/lib/spreadsheet/workbook';
import {
  CATALOG_COLUMN_WIDTHS,
  CATALOG_HEADERS,
  LIST_NAMES,
  MAX_CATALOG_ROWS,
  TEMPLATE_BLANK_ROWS,
  type CatalogField,
} from './constants';
import type { CategoryOption, StoreGroupOption, UnitOption } from './types';

export interface CatalogTemplateInput {
  categories: CategoryOption[];
  units: UnitOption[];
  storeGroups: StoreGroupOption[];
}

const FIELDS = Object.keys(CATALOG_HEADERS) as CatalogField[];
const columnOf = (field: CatalogField) => FIELDS.indexOf(field) + 1;

export async function buildCatalogTemplate(input: CatalogTemplateInput): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Productos');
  sheet.columns = FIELDS.map((field) => ({
    header: CATALOG_HEADERS[field],
    key: field,
    width: CATALOG_COLUMN_WIDTHS[field],
  }));

  styleHeaderRow(sheet, FIELDS.length);

  // El código DANE va como texto: si no, Excel se come los ceros a la izquierda.
  sheet.getColumn(columnOf('daneCode')).numFmt = '@';

  const lists: Record<string, string[]> = {
    [LIST_NAMES.categories]: input.categories.map((category) => category.path),
    [LIST_NAMES.units]: input.units.map((unit) => unit.label),
    [LIST_NAMES.yesNo]: ['Sí', 'No'],
  };

  // Sin grupos creados no hay lista que ofrecer, y un rango vacío produce una
  // referencia inválida que Excel rechaza al abrir el archivo.
  if (input.storeGroups.length > 0) {
    lists[LIST_NAMES.storeGroups] = input.storeGroups.map((group) => group.name);
  }

  const ranges = buildListsSheet(workbook, lists);

  // Desplegables: el admin elige en vez de escribir, y así no inventa
  // categorías ni unidades que no existen.
  addListValidation(sheet, columnOf('category'), ranges[LIST_NAMES.categories], {
    rows: TEMPLATE_BLANK_ROWS,
    allowBlank: false,
    message: 'Elige una categoría de la lista. Están todas en la hoja "Listas".',
  });
  addListValidation(sheet, columnOf('unit'), ranges[LIST_NAMES.units], {
    rows: TEMPLATE_BLANK_ROWS,
    allowBlank: false,
    message: 'Elige una unidad de la lista. Están todas en la hoja "Listas".',
  });
  for (const field of ['ancestral', 'medicinal', 'nonFood'] as CatalogField[]) {
    addListValidation(sheet, columnOf(field), ranges[LIST_NAMES.yesNo], {
      rows: TEMPLATE_BLANK_ROWS,
      message: 'Elige "Sí" o "No".',
    });
  }
  if (ranges[LIST_NAMES.storeGroups]) {
    addListValidation(sheet, columnOf('ownerGroup'), ranges[LIST_NAMES.storeGroups], {
      rows: TEMPLATE_BLANK_ROWS,
      // Se deja en blanco a propósito: vacío significa producto público.
      allowBlank: true,
      message: 'Elige un grupo de tiendas de la lista, o déjalo vacío para que sea público.',
    });
  }

  buildInstructionsSheet(workbook, 'Carga masiva del catálogo maestro', [
    '1. Llena una fila por producto nuevo en la hoja "Productos". Las filas vacías se ignoran.',
    `2. "${CATALOG_HEADERS.name}", "${CATALOG_HEADERS.category}" y "${CATALOG_HEADERS.unit}" son obligatorias.`,
    `3. "${CATALOG_HEADERS.category}" y "${CATALOG_HEADERS.unit}" tienen lista desplegable: úsala. Si escribes o pegas un valor que no esté en la lista, esa fila no se creará y te diremos cuál es.`,
    `4. Cuando el nombre de una subcategoría se repite bajo varios padres (por ejemplo "Hojas"), hay que usar la ruta completa "Padre > Subcategoría". Por eso la lista las muestra así.`,
    `5. "${CATALOG_HEADERS.ancestral}", "${CATALOG_HEADERS.medicinal}" y "${CATALOG_HEADERS.nonFood}" aceptan "Sí" o "No"; si las dejas vacías quedan en "No".`,
    `6. "${CATALOG_HEADERS.description}", "${CATALOG_HEADERS.daneCode}" y "${CATALOG_HEADERS.daneUnit}" son opcionales.`,
    `7. "${CATALOG_HEADERS.ownerGroup}" es para los productos que aporta una tienda con sus propias fotos: solo las tiendas de ese grupo podrán publicarlos. Déjala vacía y el producto queda público para todas.`,
    '8. Si el nombre ya existe en el catálogo, esa fila se omite y te decimos en qué categoría está el existente.',
    '9. Los productos se crean SIN imagen y activos. La foto se agrega después editando cada producto.',
    `10. Puedes cargar hasta ${MAX_CATALOG_ROWS} productos por archivo. La plantilla trae ${TEMPLATE_BLANK_ROWS} filas con desplegable; si necesitas más, copia el formato hacia abajo.`,
    '11. Guarda como Excel (.xlsx) o CSV y súbelo desde Catálogo Maestro → Carga masiva.',
  ]);

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
