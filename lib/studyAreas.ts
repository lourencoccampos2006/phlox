// ─── Áreas de estudo da saúde — matérias por curso ───────────────────────────
// O onboarding guarda a área; o modo estudante adapta-se (não é só anatomia:
// inclui química, matemática/estatística, etc. conforme o curso).

export interface StudyArea { label: string; subjects: string[] }

export const STUDY_AREAS: Record<string, StudyArea> = {
  medicine:     { label: 'Medicina', subjects: ['Anatomia', 'Fisiologia', 'Bioquímica', 'Farmacologia', 'Patologia', 'Microbiologia', 'Semiologia', 'Cardiologia', 'Neurologia', 'Estatística'] },
  dentistry:    { label: 'Medicina Dentária', subjects: ['Anatomia dentária', 'Oclusão', 'Patologia oral', 'Materiais dentários', 'Endodontia', 'Periodontologia', 'Farmacologia', 'Radiologia oral'] },
  pharmacy:     { label: 'Farmácia', subjects: ['Farmacologia', 'Farmacotecnia', 'Farmacognosia', 'Química Farmacêutica', 'Bioquímica', 'Farmacocinética', 'Cuidados Farmacêuticos', 'Análises'] },
  nursing:      { label: 'Enfermagem', subjects: ['Anatomia', 'Fisiologia', 'Fundamentos de Enfermagem', 'Farmacologia', 'Médico-cirúrgica', 'Saúde Materna', 'Saúde Mental', 'Cálculo de dose'] },
  biomedical:   { label: 'Análises Clínicas', subjects: ['Bioquímica', 'Hematologia', 'Microbiologia', 'Imunologia', 'Genética', 'Parasitologia', 'Estatística', 'Controlo de Qualidade'] },
  physiotherapy:{ label: 'Fisioterapia', subjects: ['Anatomia', 'Cinesiologia', 'Fisiologia do Exercício', 'Biomecânica', 'Reabilitação', 'Neurologia', 'Cardiorrespiratória'] },
  nutrition:    { label: 'Nutrição', subjects: ['Bioquímica', 'Fisiologia', 'Nutrição Clínica', 'Bromatologia', 'Química Alimentar', 'Dietética', 'Microbiologia Alimentar'] },
  veterinary:   { label: 'Veterinária', subjects: ['Anatomia Animal', 'Fisiologia', 'Farmacologia Veterinária', 'Patologia', 'Microbiologia', 'Clínica de Pequenos Animais', 'Parasitologia'] },
  psychology:   { label: 'Psicologia', subjects: ['Psicologia Geral', 'Neurociência', 'Psicopatologia', 'Psicofarmacologia', 'Estatística', 'Avaliação Psicológica', 'Desenvolvimento'] },
  other:        { label: 'Saúde', subjects: ['Anatomia', 'Fisiologia', 'Bioquímica', 'Farmacologia', 'Estatística'] },
}

export function areaOf(id: string | null | undefined): StudyArea {
  return STUDY_AREAS[id || 'other'] || STUDY_AREAS.other
}
