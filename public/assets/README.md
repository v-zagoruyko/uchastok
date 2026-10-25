# Assets

Текстуры скачаны с Poly Haven (https://polyhaven.com), лицензия CC0 (public domain), 1K JPG: `diff` (цвет), `nor` (normal, OpenGL), `rough`. Контрольные суммы проверены по `api.polyhaven.com/files/<id>`. Размер плитки в метрах (поле `dimensions` в `api.polyhaven.com/info/<id>`) задан в `src/textures.ts`.

| Папка | Набор | Автор | Плитка, м | Где используется |
|---|---|---|---|---|
| `grass_ground` | https://polyhaven.com/a/grass_ground | Charlotte Baglioni | 2.51 | земля, газон |
| `brown_mud_dry` | https://polyhaven.com/a/brown_mud_dry | Rob Tuytel | 1.3 | дорога, грядки |
| `brown_planks_03` | https://polyhaven.com/a/brown_planks_03 | Rob Tuytel | 1.0 | стены сараев, штакетник |
| `asbestos_sheet` | https://polyhaven.com/a/asbestos_sheet | Amal Kumar | 2.0 | старая ржавая кровля и забор |
| `corrugated_iron` | https://polyhaven.com/a/corrugated_iron | Jenelle van Heerden, Dimitrios Savva | 1.12 | профнастил, шифер-забор, кровля |
| `grey_roof_tiles` | https://polyhaven.com/a/grey_roof_tiles | Rob Tuytel | 3.0 | кровля домов |
| `bark_brown_01` | https://polyhaven.com/a/bark_brown_01 | Rob Tuytel | 1.0 | стволы |
| `brushed_concrete` | https://polyhaven.com/a/brushed_concrete | Dario Barresi, Dimitrios Savva | 2.5 | бетонный ящик |
| `brick_wall_001` | https://polyhaven.com/a/brick_wall_001 | Rob Tuytel, Dimitrios Savva | 3.0 | трубы |
| `checkered_pavement_tiles` | https://polyhaven.com/a/checkered_pavement_tiles | Amal Kumar | 2.0 | плитка у теплицы |

Деревья Poly Haven (`pine_tree_01`, `fir_tree_01`) слишком тяжёлые для браузера (сотни МБ), деревья строятся кодом (`src/objects.ts`).
