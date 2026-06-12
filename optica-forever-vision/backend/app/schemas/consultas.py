from datetime import date, datetime

from pydantic import BaseModel


class RecetaLCIn(BaseModel):
    od_esf: float | None = None
    od_cil: float | None = None
    od_eje: int | None = None
    od_add: float | None = None
    od_dnp: float | None = None
    od_alt: float | None = None
    oi_esf: float | None = None
    oi_cil: float | None = None
    oi_eje: int | None = None
    oi_add: float | None = None
    oi_dnp: float | None = None
    oi_alt: float | None = None
    tipo_lente: str | None = None
    tipo_armadura: str | None = None
    observaciones: str | None = None


class RecetaCLIn(BaseModel):
    od_marca: str | None = None
    od_bc: float | None = None
    od_diam: float | None = None
    od_esf: float | None = None
    od_cil: float | None = None
    od_eje: int | None = None
    oi_marca: str | None = None
    oi_bc: float | None = None
    oi_diam: float | None = None
    oi_esf: float | None = None
    oi_cil: float | None = None
    oi_eje: int | None = None
    observaciones: str | None = None


class ConsultaCreate(BaseModel):
    fecha: date
    motivo_consulta: str | None = None
    antecedentes: str | None = None
    avsc_od: str | None = None
    avsc_oi: str | None = None
    avsc_ao: str | None = None
    avcc_od: str | None = None
    avcc_oi: str | None = None
    avcc_ao: str | None = None
    rx_od_esf: float | None = None
    rx_od_cil: float | None = None
    rx_od_eje: int | None = None
    rx_od_add: float | None = None
    rx_od_av: str | None = None
    rx_oi_esf: float | None = None
    rx_oi_cil: float | None = None
    rx_oi_eje: int | None = None
    rx_oi_add: float | None = None
    rx_oi_av: str | None = None
    k_od_1: float | None = None
    k_od_2: float | None = None
    k_od_eje: int | None = None
    k_oi_1: float | None = None
    k_oi_2: float | None = None
    k_oi_eje: int | None = None
    pio_od: float | None = None
    pio_oi: float | None = None
    cover_test_vl: str | None = None
    cover_test_vp: str | None = None
    motilidad: str | None = None
    estereopsis: str | None = None
    seg_anterior_od: str | None = None
    seg_anterior_oi: str | None = None
    fondo_od: str | None = None
    fondo_oi: str | None = None
    diag_od: str | None = None
    diag_oi: str | None = None
    diagnostico: str | None = None
    plan_tratamiento: str | None = None
    observaciones: str | None = None
    proximo_control: date | None = None
    receta_lc: RecetaLCIn | None = None
    receta_cl: RecetaCLIn | None = None


class ConsultaUpdate(ConsultaCreate):
    fecha: date | None = None


class RecetaOut(BaseModel):
    id: int
    tipo: str
    lc_od_esf: float | None
    lc_od_cil: float | None
    lc_od_eje: int | None
    lc_od_add: float | None
    lc_od_dnp: float | None
    lc_od_alt: float | None
    lc_oi_esf: float | None
    lc_oi_cil: float | None
    lc_oi_eje: int | None
    lc_oi_add: float | None
    lc_oi_dnp: float | None
    lc_oi_alt: float | None
    tipo_lente: str | None
    tipo_armadura: str | None
    cl_od_marca: str | None
    cl_od_bc: float | None
    cl_od_diam: float | None
    cl_od_esf: float | None
    cl_od_cil: float | None
    cl_od_eje: int | None
    cl_oi_marca: str | None
    cl_oi_bc: float | None
    cl_oi_diam: float | None
    cl_oi_esf: float | None
    cl_oi_cil: float | None
    cl_oi_eje: int | None
    observaciones: str | None

    model_config = {"from_attributes": True}


class ConsultaOut(BaseModel):
    id: int
    numero: str
    paciente_id: int
    optometrista_id: int
    fecha: date
    motivo_consulta: str | None
    antecedentes: str | None
    avsc_od: str | None
    avsc_oi: str | None
    avsc_ao: str | None
    avcc_od: str | None
    avcc_oi: str | None
    avcc_ao: str | None
    rx_od_esf: float | None
    rx_od_cil: float | None
    rx_od_eje: int | None
    rx_od_add: float | None
    rx_od_av: str | None
    rx_oi_esf: float | None
    rx_oi_cil: float | None
    rx_oi_eje: int | None
    rx_oi_add: float | None
    rx_oi_av: str | None
    k_od_1: float | None
    k_od_2: float | None
    k_od_eje: int | None
    k_oi_1: float | None
    k_oi_2: float | None
    k_oi_eje: int | None
    pio_od: float | None
    pio_oi: float | None
    cover_test_vl: str | None
    cover_test_vp: str | None
    motilidad: str | None
    estereopsis: str | None
    seg_anterior_od: str | None
    seg_anterior_oi: str | None
    fondo_od: str | None
    fondo_oi: str | None
    diag_od: str | None
    diag_oi: str | None
    diagnostico: str | None
    plan_tratamiento: str | None
    observaciones: str | None
    proximo_control: date | None
    created_at: datetime
    recetas: list[RecetaOut]

    model_config = {"from_attributes": True}


class ConsultaListItem(BaseModel):
    id: int
    numero: str
    fecha: date
    motivo_consulta: str | None
    diagnostico: str | None
    rx_od_esf: float | None = None
    rx_od_cil: float | None = None
    rx_od_eje: int | None = None
    rx_od_add: float | None = None
    rx_oi_esf: float | None = None
    rx_oi_cil: float | None = None
    rx_oi_eje: int | None = None
    rx_oi_add: float | None = None
    recetas: list[RecetaOut] = []
    created_at: datetime

    model_config = {"from_attributes": True}


class ConsultaGlobalItem(BaseModel):
    id: int
    numero: str
    fecha: date
    paciente_id: int
    paciente_nombre: str
    motivo_consulta: str | None
    diagnostico: str | None
    rx_od_esf: float | None
    rx_od_cil: float | None
    rx_od_eje: int | None
