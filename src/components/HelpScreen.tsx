/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import {
  X, ChevronDown, HelpCircle, LayoutDashboard, Building2, Beef, Wheat, Wallet,
  Tractor, UserCog, FileText, Sparkles, Users, Receipt, Package, PawPrint,
  Scale, MapIcon, Calendar, BarChart3, Leaf, Settings, CloudSun, Bell, Moon,
  CreditCard, Image as ImageIcon, Smartphone, ShieldAlert,
} from 'lucide-react';

interface Section {
  icon: typeof LayoutDashboard;
  title: string;
  content: string[];
}

const SECTIONS: Section[] = [
  {
    icon: LayoutDashboard,
    title: 'Painel',
    content: [
      'Visão geral da fazenda: gastos totais, total de animais, custo por cabeça e ganho de peso mensal.',
      'O card "Sugestão Inteligente" traz um conselho automático baseado nos seus dados — clique em "Atualizar Conselho" para gerar um novo.',
      'O card de data (com o ícone de sol/nuvem) é clicável e leva direto para o Clima Agora.',
      'O painel "Alertas Climáticos" mostra restrições do dia (chuva forte, vento, calor, geada) para a propriedade ativa — depende da localização estar cadastrada em Propriedades.',
      'O painel "Outros módulos" resume Financeiro, Agricultura, Pecuária Profissional, Máquinas e Documentos, com atalho direto ao clicar em cada card.',
    ],
  },
  {
    icon: Building2,
    title: 'Propriedades',
    content: [
      'Cadastre cada fazenda, sítio, chácara, arrendamento ou parceria separadamente — todos os dados do sistema (animais, despesas, talhões etc.) ficam vinculados à propriedade ativa.',
      'Se você tem mais de uma propriedade, um seletor aparece no cabeçalho para trocar entre elas a qualquer momento.',
      'O botão "Usar minha localização atual (GPS)" no cadastro é importante: sem localização, os Alertas Climáticos e o Consultor Rural não conseguem checar o clima daquela propriedade.',
      'A unidade de área (hectare, alqueire, tarefa, etc.) é configurável por propriedade — o número digitado não é convertido automaticamente entre unidades.',
      'Excluir a única propriedade é permitido; uma nova, vazia, pode ser criada em seguida com o nome que você quiser.',
    ],
  },
  {
    icon: Beef,
    title: 'Pecuária Profissional',
    content: [
      '"Cadastro por Lote" reaproveita a tela Animais — compra, aluguel, meia, terceiros, venda e cálculo financeiro por lote.',
      '"Cadastro Individual" registra cada animal por brinco/RFID, com raça, categoria, genealogia (pais) e status.',
      '"Reprodução" registra cobertura, inseminação, IATF, diagnóstico de prenhez, parto e desmama. A previsão de parto é calculada sozinha (283 dias após a cobertura/IA/IATF), e a previsão de desmama/apartação também é calculada automaticamente a partir da data do parto (~210 dias).',
      '"Sanidade" registra vacinas, vermífugos, medicamentos e exames, com data de reforço — esses avisos aparecem também na Central de Obrigações (sino no topo).',
      '"Produção Leiteira" registra litros por vaca ou por lote, com CCS e CBT opcionais, e soma o total do mês automaticamente.',
      'Nenhum campo é obrigatório em nenhuma dessas telas — você pode salvar preenchendo só o que quiser.',
    ],
  },
  {
    icon: Wheat,
    title: 'Agricultura',
    content: [
      '"Talhões" cadastra cada área de plantio, com cultura atual, status (ativo/em descanso/em preparo) e tipo de solo.',
      '"Planejamento Agrícola" registra o que será plantado em cada safra, com datas previstas de plantio e colheita — essas datas também avisam na Central de Obrigações.',
      '"Caderno de Campo" registra plantio, pulverização, adubação, controle de pragas/doenças e colheita, com responsável, produto e GPS. Ao registrar pulverização/aplicação foliar/controle de pragas, um aviso amarelo aparece se o clima do dia não for favorável (chuva ou vento fortes) — mas isso nunca impede de salvar.',
      '"Manejo de Pragas" registra o tipo de praga, nível de infestação e ação de controle tomada.',
      '"Irrigação" registra método (gotejamento, aspersão, pivô central), duração e volume de água usado.',
    ],
  },
  {
    icon: Wallet,
    title: 'Financeiro',
    content: [
      '"Contas a Pagar" e "Contas a Receber" — cadastre com descrição, valor, vencimento e centro de custo. Vencimentos próximos avisam na Central de Obrigações.',
      '"Centros de Custo" agrupa despesas/receitas por safra ou por lote de animal, para saber onde o dinheiro está sendo gasto ou ganho.',
      '"Fluxo de Caixa" mostra o saldo projetado: total a receber menos total a pagar — é uma projeção simples, não um extrato bancário.',
    ],
  },
  {
    icon: Tractor,
    title: 'Máquinas',
    content: [
      '"Cadastro" registra trator, colheitadeira, pulverizador, caminhão etc., com placa, horímetro e consumo médio.',
      '"Manutenção" registra serviços preventivos e corretivos, com custo e o horímetro previsto para a próxima revisão.',
    ],
  },
  {
    icon: UserCog,
    title: 'RH Rural',
    content: [
      '"Equipes" agrupa funcionários por time de trabalho.',
      '"Escalas" define dias da semana e horário de cada funcionário/equipe.',
      '"Treinamentos" registra capacitações realizadas.',
      '"EPIs" controla entrega de equipamentos de segurança, com data de validade.',
      '"Certificações" registra certificados dos funcionários, com validade.',
      'Pagamentos de salário continuam na tela separada "Funcionários", no menu principal.',
    ],
  },
  {
    icon: FileText,
    title: 'Documentos',
    content: [
      'Guarda CAR, CCIR, ITR, contratos, licenças ambientais e receituários agronômicos, com data de validade.',
      'Você pode anexar uma foto ou PDF pequeno (até ~700KB) — fotos são comprimidas automaticamente. O arquivo fica guardado dentro do próprio banco de dados, sem custo extra.',
      'Documentos vencendo em até 30 dias aparecem destacados no topo da tela.',
    ],
  },
  {
    icon: Sparkles,
    title: 'Consultor Rural IA',
    content: [
      'Pergunte em português sobre clima, financeiro, talhões, rebanho, reprodução, vacinas, produção de leite, documentos, máquinas ou estoque.',
      'Não depende de nenhuma inteligência artificial externa nem chave de API — responde na hora, cruzando os dados reais já cadastrados no sistema por palavra-chave.',
      'Se a pergunta não for reconhecida, ele avisa e sugere os temas que consegue responder.',
    ],
  },
  {
    icon: Users,
    title: 'Funcionários',
    content: [
      'Cadastro de funcionários com cargo, data de admissão, férias e aviso prévio.',
      'Registro de pagamentos (salário e outros) por funcionário, com histórico.',
    ],
  },
  {
    icon: Receipt,
    title: 'Despesas',
    content: [
      'Registro de despesas variáveis (não recorrentes) da fazenda, por categoria e fornecedor.',
      'Despesas com vencimento e status "pendente" aparecem na Central de Obrigações.',
    ],
  },
  {
    icon: Package,
    title: 'Estoque Suprimentos',
    content: [
      'Controle de insumos (sal, ração, sementes) e equipamentos, com quantidade, fornecedor e histórico de movimentação.',
      'Defina estoque mínimo e crítico em cada item para receber alertas visuais quando a quantidade cair muito.',
    ],
  },
  {
    icon: PawPrint,
    title: 'Animais',
    content: [
      'Cadastro de lotes de animais: próprio, aluguel, meia ou terceiros — com compra, venda, custos e receita calculados automaticamente.',
      'No tipo "Aluguel", cadastre o dia de vencimento mensal do pagamento — a Central de Obrigações avisa 2 dias antes, no dia (a partir das 8h), e destaca em vermelho se passar do prazo sem marcar como pago.',
      'Esta mesma tela também está disponível dentro de Pecuária Profissional, na aba "Cadastro por Lote" — são os mesmos dados, em dois lugares por conveniência.',
    ],
  },
  {
    icon: Scale,
    title: 'Planilha Pesagem',
    content: [
      'Calculadora de pesagem de gado: informe quantidade e peso total do lote, e o sistema calcula sozinho @ (arrobas), valor por arroba e valor total.',
      'Você pode criar várias planilhas separadas (uma por dia ou por lote) e adicionar observações gerais em cada uma.',
    ],
  },
  {
    icon: MapIcon,
    title: 'Pastos',
    content: [
      'Cadastro de cada pasto/piquete, com tamanho, gramíneas, finalidade (engorda/manutenção/finalização) e capacidade de lotação nas águas e na seca.',
      'O "Simulador IA Agronômico de Capacidade" sugere a lotação ideal com base na espécie de gramínea e no tamanho do pasto.',
      'Defina a data do "Próximo Remanejo" para ser avisado na Central de Obrigações quando for hora de trocar os animais de pasto.',
    ],
  },
  {
    icon: Calendar,
    title: 'Tarefas',
    content: [
      'Lista de afazeres da fazenda, com prazo, prioridade, responsável e local de execução.',
      'Tarefas com prazo próximo aparecem na Central de Obrigações; marque como concluída para elas saírem da lista.',
    ],
  },
  {
    icon: BarChart3,
    title: 'Relatórios',
    content: [
      'Gráficos e resumos consolidados de gastos, produção e desempenho da fazenda ao longo do tempo.',
    ],
  },
  {
    icon: Leaf,
    title: 'Cálculo Nutrição',
    content: [
      'Calculadora de necessidades nutricionais do rebanho, com base em categoria animal e objetivo produtivo.',
    ],
  },
  {
    icon: Settings,
    title: 'Configurações',
    content: [
      'Nome da fazenda, cidade/região (usada para cálculos climáticos), data de aniversário (opcional) e outras preferências gerais do sistema.',
      'O botão "Ativar notificações push" permite receber avisos de vencimento e comunicados do administrador direto no seu celular, mesmo com o app fechado — pede sua permissão uma única vez.',
    ],
  },
  {
    icon: CreditCard,
    title: 'Minha Assinatura',
    content: [
      'Mostra seu plano atual, valor mensal, data de validade e último pagamento.',
      'Você pode cancelar sua assinatura a qualquer momento por aqui — o acesso continua até o fim do período já pago.',
      'Se sua conta ficar "Suspensa" ou "Bloqueada" pelo administrador, o acesso ao restante do aplicativo fica temporariamente indisponível até a situação ser regularizada.',
    ],
  },
  {
    icon: ImageIcon,
    title: 'Publicidade (carrossel no Painel)',
    content: [
      'Um espaço de anúncios pode aparecer no final do Painel, gerenciado pelo administrador — troca sozinho a cada 5 segundos, ou você pode navegar manualmente com as setas.',
    ],
  },
  {
    icon: Smartphone,
    title: 'Instalar como aplicativo (PWA)',
    content: [
      'O Agro Gestão pode ser instalado no seu celular ou computador como um aplicativo de verdade, com ícone próprio — sem precisar baixar de nenhuma loja de aplicativos.',
      'No Chrome/Edge, procure o botão "Instalar" na barra de endereço ou no menu do navegador. No iPhone (Safari), use "Compartilhar" → "Adicionar à Tela de Início".',
      'Funciona parcialmente offline (você consegue reabrir o app sem internet, mas precisa de conexão para salvar ou carregar dados novos).',
    ],
  },
  {
    icon: CloudSun,
    title: 'Clima Agora',
    content: [
      'Previsão do tempo completa para a sua região, embutida diretamente dentro do Fazenda — sem precisar sair do aplicativo.',
    ],
  },
  {
    icon: Bell,
    title: 'Central de Obrigações (sino no topo)',
    content: [
      'Reúne todos os avisos de vencimento do sistema em um só lugar: tarefas, despesas, custos fixos, aluguel de animais, vacinas, plantio/colheita, contas a pagar/receber, apartação de bezerros e remanejo de pasto.',
      'Avisos aparecem a partir de 3 dias antes do vencimento (ou 2 dias, no caso do aluguel de animais) e ficam vermelhos quando vencidos.',
      '"Fechar" apenas esconde o aviso na sua tela atual — ele volta a aparecer depois. "Concluir" marca como resolvido de verdade.',
    ],
  },
  {
    icon: Moon,
    title: 'Alternância de tema (ícone de lua/sol no topo)',
    content: [
      'Alterna entre modo claro e escuro. O padrão do sistema é o modo claro.',
      'Algumas telas mais antigas mantêm sempre o visual claro original, mesmo com o modo escuro ativado no restante do aplicativo — isso é proposital, para garantir que o texto continue sempre legível nelas.',
    ],
  },
  {
    icon: ShieldAlert,
    title: 'Painel Admin (visível só para administradores)',
    content: [
      '"Visão Geral" mostra usuários ativos, assinaturas por status, receita e despesas do aplicativo.',
      '"Usuários" lista todas as contas, com busca, filtro por status, e botões para ativar, suspender, bloquear, cancelar ou excluir qualquer uma.',
      '"Notificações" envia avisos para todos os usuários, para um usuário específico, ou filtrado por cidade, região ou mês de aniversário — chegam tanto dentro do app quanto por notificação push (se configurada).',
      '"Publicidade" cadastra os anúncios do carrossel exibido no Painel dos usuários — banner com imagem (upload direto, comprimida automaticamente), vídeo, texto, texto com link ou imagem com link.',
      '"Despesas do App" é um registro manual dos custos do próprio negócio (hospedagem, taxas etc.), usado para calcular o resultado financeiro do aplicativo.',
    ],
  },
];

export default function HelpScreen({ onClose }: { onClose: () => void }) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center p-0 md:p-4">
      <div className="bg-theme-card w-full max-w-2xl md:rounded-3xl overflow-hidden flex flex-col h-full md:h-auto md:max-h-[85vh] shadow-2xl">
        <div className="p-5 border-b border-theme flex items-center justify-between shrink-0">
          <h2 className="text-lg font-bold text-theme-primary flex items-center gap-2">
            <HelpCircle className="text-primary" size={22} /> Como usar o Agro Gestão
          </h2>
          <button onClick={onClose} className="p-2 rounded-full bg-theme-secondary text-theme-secondary hover:opacity-80">
            <X size={18} />
          </button>
        </div>

        <p className="px-5 pt-4 text-xs text-theme-secondary shrink-0">
          Toque em cada módulo abaixo para ver o que ele faz e como usar.
        </p>

        <div className="flex-1 overflow-y-auto p-5 space-y-2">
          {SECTIONS.map((section, i) => {
            const isOpen = openIndex === i;
            return (
              <div key={section.title} className="border border-theme rounded-2xl overflow-hidden">
                <button
                  onClick={() => setOpenIndex(isOpen ? null : i)}
                  className="w-full flex items-center gap-3 p-3.5 text-left hover:bg-theme-secondary transition-colors"
                >
                  <section.icon size={18} className="text-primary shrink-0" />
                  <span className="flex-1 font-bold text-sm text-theme-primary">{section.title}</span>
                  <ChevronDown size={16} className={`text-theme-secondary shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>
                {isOpen && (
                  <div className="px-4 pb-4 pt-1 space-y-2 bg-theme-secondary/40">
                    {section.content.map((line, j) => (
                      <p key={j} className="text-xs text-theme-secondary leading-relaxed">• {line}</p>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
