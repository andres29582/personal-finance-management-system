# ML reproducible en CI

Objetivo: Ubuntu 24.04, Linux x86_64 y CPython **3.11.18**. `requirements.txt`
conserva los rangos de compatibilidad; `requirements-ci.lock` fija 47 paquetes
directos y transitivos con hashes. Este lock es específico de Linux e incluye
dependencias de plataforma como `uvloop`.

El lock se resolvió desde Windows con uv **0.13.7** para el objetivo Linux.
Esto comprueba resolución y disponibilidad de distribuciones, pero no acredita
una instalación ni una ejecución Linux. Esa validación queda preparada en el
job `ml` de `.github/workflows/ci.yml`.

Para regenerarlo desde este directorio, con uv 0.13.7 y Python 3.11.18:

```sh
uv pip compile requirements.txt --python-version 3.11.18 \
  --python-platform x86_64-unknown-linux-gnu --generate-hashes \
  --only-binary :all: --output-file requirements-ci.lock
```

Revisar el diff antes de aceptar nuevas versiones. Para instalar y comprobar
el candidato en Linux:

```sh
python3.11 -m venv .venv-ci-first
.venv-ci-first/bin/python -m pip install --require-hashes --only-binary=:all: -r requirements-ci.lock
.venv-ci-first/bin/python -m pip check
MPLBACKEND=Agg .venv-ci-first/bin/python -m pytest
```

CI repite la instalación y las pruebas en `.venv-ci-second`, un entorno
independiente. Sus límites son seis minutos por instalación, tres por ejecución
de pruebas y veinte por job. No se suben datos, modelos ni logs como artefactos.

La regeneración sigue la [resolución por plataforma de uv](https://docs.astral.sh/uv/concepts/resolution/).
El [manifiesto oficial de Python para Actions](https://github.com/actions/python-versions/blob/main/versions-manifest.json)
incluye Python 3.11.18 para Ubuntu 24.04 x64; se verificó el 12/11/2026.
