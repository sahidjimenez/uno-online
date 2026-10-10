# Personajes de NEXO

Basados en Ultimate Modular Men (febrero de 2022) y Ultimate Modular Women
(abril de 2022), creados por Quaternius. Licencia CC0 1.0; ver los archivos
man-LICENSE.txt y woman-LICENSE.txt incluidos en esta carpeta.

Fuentes: https://quaternius.com/ y los paquetes originales proporcionados
por el propietario del proyecto en S:/modelos nexo.

Adaptaciones: cuerpos Casual_2 y Casual; peinados de Suit, Soldier y Casual;
materiales de ropa independientes, normales suavizadas, postura sentada y
movimiento del brazo. La coleta combina cabello corto y una pieza adicional.
Estos modelos mantienen el estilo estilizado de los paquetes originales.

Para regenerar los GLB desde los paquetes extraídos:
node frontend/scripts/prepare-characters.mjs "S:/modelos nexo"

Solo se conserva Idle_Neutral para establecer la postura inicial.
La geometría es compartida entre jugadores; los esqueletos y materiales se
clonan para que animaciones y colores sean independientes. Si una descarga
falla se conserva el personaje procedural, sin impedir continuar la partida.
