"""Diagnóstico: muestra las primeras filas de cada hoja para verificar estructura."""
import openpyxl

wb = openpyxl.load_workbook('/app/data/OpticaRevisado.xlsm', read_only=True, data_only=True, keep_vba=False)

for sheet in ['bdPacientes', 'cabezaVentas', 'CuerpoVenta', 'bdIngresos', 'Inventario']:
    ws = wb[sheet]
    print(f'\n{"="*55}')
    print(f'HOJA: {sheet}')
    print(f'{"="*55}')
    for i, row in enumerate(ws.iter_rows(values_only=True, max_row=10)):
        if any(v is not None for v in row):
            print(f'  fila {i+1}: {list(row)[:10]}')

wb.close()
print('\n[OK] Diagnóstico completado.')

if __name__ == '__main__':
    pass
