La ruta a usar en el navegador es:  
https://www.zonapagos.com/Ciclo_Pago/Pago.aspx?rut=6C44EA66B127D743C77B3247E9FE866A97C6A5730B86 
303836BD52D257186599. 
En donde el alfanumérico es el identificador del pago a procesar. Y es asignado por zonapagos. 
7.1.3. RECEPCIÓN DE PARÁMETROS DE RESULTADO DEL PAGO    
Al finalizar el pago se realizará un llamado (sea exitoso o fallido) a una ruta en el servidor del comercio, Esta ruta debe 
ser informada a zonapagos para su configuración en el aplicativo. 
A esta ruta se enviará la siguiente información en formato GET.
Estos son los estados que maneja SONDA para los pagos:
Si el proceso de SONDA retorna que el estado de la transacción es: 
• 1: Exitosa/Aprobada 
• 1000: Rechazada 
• 1001: Error entre ACH y el Banco (Equivale a un pago Rechazado) 
• 4000: Rechazada CR 
• 4003: Error CR (Equivale a un pago rechazado) 

Ruta: https://www.zonapagos.com/Apis_CicloPago/api/VerificaciónPago  

El JSON que debe enviarse para verificar un pago es:
{ 
"int_id_comercio": 678, 
"str_usr_comercio": "Usuario", 
"str_pwd_Comercio": "Agosto17", 
"str_id_pago": "180921", 
"int_no_pago":-1 
}

int_id_comercio: es un secret que ya se encuentra en supabase.
str_usr_comercio: también es un secret que ya se encuentra en supabase.
str_pwd_Comercio: secret que ya se encuentra en supabase.
str_id_pago: El ID de pago que se crea al iniciar la transacción.
int_no_pago: Esto dice la documentación:No. Pago retornado por zonapagos, para cada transacción ejecutada. Este valor es único por cada pago para un comercio determinado. Se utiliza para filtrar la consulta utilizando  el parámetro 
“int_id_pago” y “int_no_pago”, es decir la información del pago que se retorna debe cumplir con estos dos parámetros. En caso de no enviar el No. Pago siempre se envía -1.

el json de respuesta es:
{  
"int_estado": 1, 
"int_error": 0, 
"str_detalle": null, 
"int_cantidad_pagos": 2, 
"str_res_pago": " | 
3772 |  | 200 | 1002 |  | 12500 |  |  | 123456789 | Cristina | Vargas | 319632555648 | soporte9@zonavirtual.com | opcion 11 
| opcion 12 | opcion 13 |   |   |  |  | ;  
31 | 3773 | 1 | 1 | 1 | 12500 | 12500 | 13 | camisa | 123456789 | Cristina | Vargas | 319632555648 | 
soporte9@zonavirtual.com | opcion 11 | opcion 12 | opcion 13 |   |   | 9/11/2018 12:58:41 PM | 29 | 18092100031 | 2701 | 
1022 | BANCO UNION COLOMBIANO | 1468228 | 3 | ; " 
} 