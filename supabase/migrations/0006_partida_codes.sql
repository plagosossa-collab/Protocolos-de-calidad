-- Código y título de protocolo (p. ej. "TM-02" / "PROTOCOLO TRAZADO DPTOS."), y código por ítem.
alter table partidas add column if not exists code text;
alter table partidas add column if not exists title text;
alter table partida_items add column if not exists code text;
