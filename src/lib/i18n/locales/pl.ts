import type { Messages } from "../../i18n";
import { messagesEn } from "./en";

export const messagesPl: Messages = {
  ...messagesEn,
  languageLabel: "Język",
  languageSwitching: "Zmiana języka…",
  helpOpenTooltip: "Pomoc i dziennik zmian",
  helpMenuOpen: "Otwórz pomoc",
  helpMenuManual: "Instrukcja",
  helpMenuChangelog: "Dziennik zmian",
  changelogTitle: "Dziennik zmian",
  manualTitle: "Instrukcja HT Alchemy",
  manualTocTitle: "Spis treści",
  reminderBellLabel: "Przypomnienia",
  remindersTitle: "Przypomnienia",
  reminderDueNow: "Do zrobienia",
  reminderSnoozed: "Odłożone",
  reminderDismiss: "Ukryj",
  reminderSnooze: "Odłóż",
  reminderSnooze6Hours: "6 godzin",
  reminderSnooze1Day: "1 dzień",
  reminderSnooze3Days: "3 dni",
  reminderSnooze1Week: "1 tydzień",
  remindersSnoozeForLabel: "Odłóż na",
  remindersSnoozeButtonLabel: "Odłóż",
  remindersSnoozeDurationDay: "{{count}} dzień",
  remindersSnoozeDurationDays: "{{count}} dni",
  remindersDismissedSectionTitle: "Ukryte",
  remindersNoDismissed: "Brak ukrytych przypomnień.",
  remindersDismissedAtLabel: "Ukryto {{time}}",
  reminderTurnOff: "Wyłącz przypomnienia",
  reminderOpenModal: "Otwórz",
  reminderNoDue: "Brak przypomnień do zrobienia.",
  reminderNoSnoozed: "Brak odłożonych przypomnień.",
  remindersDisabledState: "Przypomnienia są wyłączone.",
  reminderMissingActionFallback:
    "Ta akcja przypomnienia nie jest jeszcze dostępna.",
  reminderSeniorInjuryTitle: "Senior kontuzjowany",
  reminderSeniorInjuryBody:
    "{{playerName}} ma kontuzję na {{weeks}} tygodnie. Rozważ poszukanie zastępcy.",
  reminderActionFindSimilarPlayers: "Znajdź podobnych graczy",
  reminderSeniorInjuryActionUnavailable:
    "Nie udało się otworzyć funkcji Znajdź podobnych graczy dla tego przypomnienia.",
  reminderSeniorSalaryIncreaseTitle: "Pensja zawodnika znacząco wzrosła",
  reminderSeniorSalaryIncreaseBody:
    "Pensja zawodnika {{playerName}} wzrosła z {{previousSalary}} do {{currentSalary}}. Czy chcesz sprzedać tego zawodnika?",
  reminderActionSellPlayer: "Sprzedaj zawodnika",
  reminderSeniorSalaryIncreaseActionUnavailable:
    "Nie udało się otworzyć tego zawodnika w Hattricku.",
  reminderSeniorMatchLineupMissingTitle:
    "Brak rozkazów dla nadchodzącego meczu seniorów",
  reminderYouthMatchLineupMissingTitle:
    "Brak rozkazów dla nadchodzącego meczu juniorów",
  reminderMatchLineupMissingBody:
    "{{matchName}} zaczyna się za {{timeRemaining}} i nie ma ustawionych rozkazów.",
  reminderActionSetOrders: "Ustaw rozkazy",
  reminderMatchLineupMissingActionUnavailable:
    "Nie udało się przełączyć na narzędzie dla tego przypomnienia.",
  reminderYouthPromotionTitle: "Junior może wkrótce awansować",
  reminderYouthPromotionBody:
    "{{playerName}} może awansować za {{timeRemaining}}.",
  reminderActionViewPlayerInHattrick: "Zobacz gracza w Hattrick",
  reminderYouthPromotionActionUnavailable:
    "Nie udało się otworzyć tego juniora w Hattrick.",
  reminderClubChronicleArenaOccupancyTitle: "Wykorzystanie stadionu jest wysokie",
  reminderClubChronicleArenaOccupancyBody:
    "Twój stadion był zapełniony w {{occupancyPct}}% w ostatnim domowym meczu ligowym. Rozważ rozbudowę.",
  reminderClubChronicleArenaOccupancyBodyWithSoldTotal:
    "Twój stadion był zapełniony w {{occupancyPct}}% w ostatnim domowym meczu ligowym (sprzedano {{soldTotal}} z {{capacity}} miejsc). Rozważ rozbudowę.",
  reminderActionExpandArena: "Rozbuduj stadion",
  reminderClubChronicleArenaOccupancyActionUnavailable:
    "Nie udało się otworzyć strony stadionu w Hattrick.",
  sidebarCollapseTooltip: "Zwiń pasek boczny",
  sidebarExpandTooltip: "Rozwiń pasek boczny",
  supportOnKofi: "Postaw mi kawę",
  settingsDebugBuyCoffeePromptButton: "Pokaż modal postaw mi kawę",
  settingsDebugStorageButton: "Pamięć",
  settingsDebugStorageTitle: "Diagnostyka pamięci",
  settingsDebugStorageLoading: "Odczytywanie diagnostyki pamięci...",
  settingsDebugStorageOriginEstimateLabel: "Szacowana pamięć origin",
  settingsDebugStorageOriginUnavailable:
    "Szacowana pamięć origin niedostępna",
  settingsDebugStorageLocalStorageApproxLabel:
    "Przybliżone użycie localStorage",
  settingsDebugStorageBreakdownKeyColumn: "Klucz",
  settingsDebugStorageBreakdownUsageColumn: "Przybliżone użycie",
  settingsDebugStorageNoLocalStorageKeys:
    "Nie znaleziono kluczy localStorage.",
  settingsDebugStorageRefreshButton: "Odśwież",
  settingsDebugStorageError: "Nie udało się odczytać diagnostyki pamięci.",
  buyCoffeePromptTitle: "☕ Dzięki, że tu jesteś",
  buyCoffeePromptLead: "🙏 Jestem naprawdę wdzięczny, że korzystasz z HT Alchemy.",
  buyCoffeePromptBody:
    "✨ Ta aplikacja wymaga dużo stałej pracy, a jeśli Ci pomogła, postawienie mi kawy byłoby dla mnie bardzo miłym wsparciem dalszego rozwoju. Każde wsparcie pomaga mi poświęcać więcej czasu na ulepszanie i utrzymanie aplikacji.",
  buyCoffeePromptFoot:
    "💛 A jeśli nie, to też jest całkowicie w porządku. Cieszę się już z tego, że aplikacja jest dla Ciebie przydatna.",
  buyCoffeePromptAction: "☕ Postaw mi kawę",
  buyCoffeePromptLater: "🙏 Nie teraz",
  toolYouthOptimization: "Optymalizacja juniorów",
  toolSeniorOptimization: "Optymalizacja seniorów",
  toolClubChronicle: "Kronika klubu",
  mobileToolsLabel: "Narzędzia",
  mobileHelpLabel: "Pomoc",
  mobilePlayerListLabel: "Lista zawodników",
  helpOptimizerLocationTitle: "Gdzie znaleźć optymalizator",
  helpOptimizerLocationYouth:
    "Otwórz Lineup optimizer z pływającego menu, a potem szukaj tego przycisku w nagłówku składu.",
  seniorHelpOptimizerLocation:
    "Otwórz Lineup optimizer z pływającego menu, a potem szukaj tego przycisku na odpowiedniej karcie meczu.",
  watchlistOwnSeniorTeamsTitle: "Własne drużyny seniorów",
  watchlistOwnSeniorTeamsEmpty: "Nie znaleziono własnych drużyn seniorów.",
  watchlistOwnLeaguesTitle: "Własne ligi",
  watchlistOwnLeaguesEmpty: "Nie znaleziono własnych lig.",
  watchlistAllItems: "Wszystkie pozycje listy obserwowanych",
  watchlistSelectAll: "Zaznacz wszystko",
  watchlistDeselectAll: "Odznacz wszystko",
  watchlistGenderMale: "Męska",
  watchlistGenderFemale: "Żeńska",
  clubChroniclePremiumTooltip:
    "Kup licencję premium HT Alchemy, aby śledzić nieograniczoną liczbę drużyn w nieograniczonej liczbie kart i uzyskać dostęp do wszystkich innych funkcji premium.",
  clubChroniclePremiumBanner:
    "Aby odblokować nieograniczone śledzenie drużyn w nieograniczonej liczbie kart, kup licencję premium HT Alchemy.",
  clubChroniclePremiumBuyButton: "Kup licencję premium",
  clubChroniclePremiumLicenseTitle:
    "Ta funkcja wymaga licencji premium HT Alchemy.",
  clubChroniclePremiumLicenseBody:
    "Wpisz tutaj swój klucz licencyjny premium HT Alchemy, aby odblokować funkcje premium.",
  clubChroniclePremiumLicenseFieldLabel: "Klucz licencyjny",
  clubChroniclePremiumLicensePlaceholder: "Wpisz klucz licencyjny",
  clubChroniclePremiumLicenseSubmit: "Odblokuj premium",
  clubChroniclePremiumLicenseKeyRequired: "Wpisz klucz licencyjny.",
  clubChroniclePremiumLicenseUnlocked: "Premium odblokowane.",
  clubChroniclePremiumLicensePendingValidation:
    "Twój klucz licencyjny został zapisany lokalnie. Walidacja online nie jest jeszcze dostępna.",
  clubChroniclePremiumLicenseInvalid: "Ten klucz licencyjny jest nieprawidłowy.",
  clubChroniclePremiumLicenseValidationUnavailable:
    "Walidacja licencji jest teraz niedostępna. Spróbuj ponownie później.",
  clubChroniclePremiumTeamLimitReached:
    "Darmowa wersja Club Chronicle jest ograniczona do 3 śledzonych drużyn na kartę.",
  clubChroniclePremiumTabLimitReached:
    "Darmowa wersja Club Chronicle jest ograniczona do 2 kart.",
  clubChroniclePremiumHiddenTeamsNotice:
    "{{count}} zapisanych w pamięci śledzonych drużyn pozostaje ukrytych do czasu odblokowania premium.",
  clubChroniclePremiumOtherTeamsMessage:
    "Kup licencję premium HT Alchemy, aby zobaczyć te dane dla innych śledzonych drużyn.",
  clubChronicleLimitTitle: "Osiagnieto limit Club Chronicle",
  clubChronicleLimitBody:
    "Aby ograniczyc zasoby serwera, Club Chronicle jest ograniczony do {{tabs}} kart i {{teams}} sledzonych zespolow na karte.",
  clubChronicleLimitConfirm: "Rozumiem",
  clubChronicleLimitTooltip:
    "Club Chronicle osiagnal aktualny limit kart lub zespolow.",
  appLicenseFeatureSeniorSimulationTitle: "Edytuj skille, wiek, pensję, TSI",
  appLicenseFeatureSeniorSimulationDescription:
    "Edytuj atrybuty zawodnika, aby zobaczyć, jak zmieniają się metryki Foxtricka. To znacząco poprawia decyzje zakupowe dotyczące zawodników.",
  appLicenseFeatureSeniorRatingsTitle: "Edytuj oceny ręcznie",
  appLicenseFeatureSeniorRatingsDescription:
    "Zawodnicy są wybierani na podstawie ocen. Edytuj ręcznie macierz ocen, aby wymuszać lub blokować wybór zawodników i precyzyjniej dostroić skład.",
  appLicenseFeatureSeniorManMarkingTitle: "Krycie indywidualne",
  appLicenseFeatureSeniorManMarkingDescription:
    "Automatycznie wybiera cel krycia indywidualnego, jeśli taki istnieje, oraz odpowiedniego kryjącego, jeśli taki istnieje. Jeśli cel zostanie wystawiony przez drużynę przeciwną, ryzyko kary za krycie indywidualne jest zerowe dzięki AI. Suwak rygoru MM pomaga doprecyzować wykrywanie celu.",
  appLicenseFeatureSeniorFixedFormationTitle: "Optymalizuj według formacji",
  appLicenseFeatureSeniorFixedFormationDescription:
    "Wygeneruj najsilniejszy skład dla konkretnej formacji. To pomaga porównywać ustawienia zależne od formacji i wybrać najlepszy skład dla układu, który chcesz zagrać.",
  appLicenseFeatureYouthEstimateValueTitle: "Oszacuj wartość",
  appLicenseFeatureYouthEstimateValueDescription:
    "Sprawdź rynek transferowy dla zawodnika z tymi znanymi maksymalnymi umiejętnościami w wieku promocji. To pomaga zrozumieć, za ile sprzeda się twój junior.",
  appLicenseFeatureYouthDoubleRevealTitle: "Optymalizacja podwójnego odkrycia",
  appLicenseFeatureYouthDoubleRevealDescription:
    "Optymalizuj skład tak, aby zmaksymalizować szansę odkrycia dwóch przydatnych umiejętności w tym samym meczu: jednej wartości bieżącej i jednej wartości maksymalnej, dla dwóch różnych zawodników lub tego samego zawodnika. To pomaga wyciągnąć więcej informacji z jednego składu juniorskiego i przyspiesza ocenę zawodników.",
  appLicenseFeatureChronicleFormationsTitle: "Formacje i taktyki",
  appLicenseFeatureChronicleFormationsDescription:
    "Pokazuje formacje i taktyki używane przez tę drużynę w poprzednich meczach. To pomaga wybrać najbardziej optymalny skład na podstawie historii ustawień drużyny przeciwnej.",
  appLicenseFeatureChronicleLikelyTrainingTitle: "Prawdopodobny reżim treningowy",
  appLicenseFeatureChronicleLikelyTrainingDescription:
    "Wnioskuje, co trenuje ta drużyna na podstawie formacji używanych w meczach treningowych.",
  clubChronicleLikelyTraineeLegendLabel:
    "Zielone wiersze oznaczają prawdopodobnych trenowanych zawodników.",
  clubChronicleLikelyTraineeLegendRegimen:
    "Prawdopodobny typ treningu: {{regimen}}",
  clubChronicleDetailModalMatchesUsedLabel:
    "Dane pobrano z {{count}} meczów.",
  clubChronicleDetailModalMatchesDebugTitle: "Uwzględnione mecze",
  clubChronicleDetailModalMatchesDebugMatchLabel: "Mecz {{matchId}}",
  clubChronicleDetailModalMatchesDebugMeta: "{{type}} · {{dateTime}}",
  appLicenseFeatureChronicleTrackingTitle: "Nielimitowane śledzenie Club Chronicle",
  appLicenseFeatureChronicleTrackingDescription:
    "Odblokuj dodatkowe karty Club Chronicle i śledź więcej drużyn na kartę. Dzięki temu możesz obserwować większe grupy rywali bez przycinania watchlisty.",
  clubChronicleTabDefaultName: "Karta {{number}}",
  clubChronicleTabAdd: "Dodaj kartę",
  clubChronicleTabRenamePlaceholder: "Nazwa karty",
  clubChronicleTabRenameTooltip: "Zmień nazwę karty",
  clubChronicleTabShortcutHint: "Poprz./nast.: j/k",
  clubChronicleTabDeleteTooltip: "Usuń kartę",
  clubChronicleTabDeleteTitle: "Usunąć tę kartę?",
  clubChronicleTabDeleteBody:
    "Ta karta Club Chronicle wraz z listą obserwowanych, najnowszymi aktualizacjami i stanem lokalnym zostanie usunięta. Tej operacji nie można cofnąć.",
  clubChronicleTabDeleteConfirm: "Usuń kartę",
  clubChronicleHelpBulletTabs:
    "Karty pomagają organizować różne przestrzenie Chronicle. Każda karta zachowuje własną listę obserwowanych i własne najnowsze aktualizacje.",
  clubChronicleHelpBulletLeague:
    "Forma ligowa: tabela z pozycja, punktami, seria, pucharem, zmiana pozycji i bilansem bramek. Wartosc pucharu pochodzi z teamdetails i pokazuje Brak, gdy druzyna odpadla z pucharu. Kliknij wiersz, aby zobaczyc porownanie poprzedni/obecny dla kazdego atrybutu.",
  clubChronicleHelpBulletFinance:
    "Bilans transferowy: liczba zakupow, liczba sprzedazy i saldo w EUR. Kliknij wiersz, aby zobaczyc szczegolowy rozklad wartosci.",
  clubChronicleFinancePanelTitle: "Bilans transferowy",
  clubChronicleFinanceColumnEstimate: "Saldo",
  clubChronicleLeaguePanelTitle: "Forma ligowa i puchar",
  feedbackTooltip: "Opinie",
  feedbackBug: "Zgłoś błąd",
  feedbackFeature: "Poproś o funkcję",
  feedbackBugTitle: "Zgłoszenie błędu",
  feedbackFeatureTitle: "Prośba o funkcję",
  feedbackFieldTitle: "Tytuł",
  feedbackFieldProblem: "Na czym polega problem?",
  feedbackFieldReproduce: "Jak to odtworzyć",
  feedbackFieldExpected: "Oczekiwane zachowanie",
  feedbackFieldActual: "Rzeczywiste zachowanie",
  feedbackFieldProposed: "Proponowane rozwiązanie",
  feedbackFieldAlternatives: "Rozważane alternatywy",
  feedbackFieldNotes: "Dodatkowe uwagi",
  feedbackBugTitlePlaceholder: "Krótki opis błędu",
  feedbackFeatureTitlePlaceholder: "Krótki opis funkcji",
  feedbackFieldProblemPlaceholder: "Opisz problem lub kontekst",
  feedbackFieldReproducePlaceholder:
    "Wypisz kroki, które wywołują problem",
  feedbackFieldExpectedPlaceholder: "Co powinno się wydarzyć?",
  feedbackFieldActualPlaceholder: "Co wydarzyło się zamiast tego?",
  feedbackFieldProposedPlaceholder: "Opisz zmianę, której chcesz",
  feedbackFieldAlternativesPlaceholder:
    "Wypisz inne rozważane podejścia",
  feedbackFieldNotesPlaceholder: "Wszystko inne, co warto dodać",
  feedbackTitleRequired: "Tytuł jest wymagany.",
  feedbackSubmit: "Wyślij",
  feedbackSubmitting: "Wysyłanie…",
  feedbackBugSuccess: "Zgłoszenie błędu wysłane.",
  feedbackFeatureSuccess: "Prośba o funkcję wysłana.",
  feedbackSubmitError: "Wysłanie zgłoszenia nie powiodło się.",
  feedbackUsernameDisclaimer:
    "Twoja nazwa użytkownika Hattrick zostanie dołączona do tego zgłoszenia, aby deweloper mógł skontaktować się z Tobą w razie pytań uzupełniających.",
  feedbackMetadataHattrickUser: "Uzytkownik Hattrick",
  feedbackManagerIdentityRequiredError:
    "Nie udalo sie ustalic nazwy uzytkownika i ID uzytkownika Hattrick do metadanych zgloszenia.",
  settingsTooltip: "Ustawienia",
  settingsExport: "Eksportuj dane",
  settingsImport: "Importuj dane",
  settingsExportSuccess: "Eksport gotowy.",
  settingsExportFailed: "Eksport nieudany.",
  settingsImportSuccess: "Import zakończony. Odświeżam…",
  settingsImportFailed: "Import nieudany.",
  settingsAlgorithms: "Algorytmy",
  settingsAlgorithmsTitle: "Ustawienia algorytmów",
  settingsYouth: "Juniorzy",
  settingsYouthTitle: "Ustawienia juniorów",
  settingsYouthStalenessLabel: "Auto-odświeżanie po (dniach)",
  settingsSenior: "Seniorzy",
  settingsSeniorTitle: "Ustawienia seniorów",
  settingsSeniorStalenessLabel: "Auto-odświeżanie po (dniach)",
  settingsSeniorRatingsWipeLabel: "Reset macierzy ocen",
  settingsSeniorRatingsWipeButton: "Wyczyść macierz ocen seniorów",
  settingsSeniorRatingsWipeWarningTitle: "Wyczyść macierz ocen seniorów",
  settingsSeniorRatingsWipeWarningBody:
    "Tej operacji nie można cofnąć. Przy następnym odświeżeniu oceny zostaną automatycznie odbudowane z tego i poprzedniego sezonu w rosnącej kolejności dat meczów. Każde kolejne odświeżenie będzie już uwzględniało tylko nowe, nieprzetworzone mecze.",
  settingsSeniorRatingsWipeWarningAcknowledge: "Rozumiem",
  settingsGeneral: "Ogólne",
  settingsGeneralTitle: "Ustawienia ogólne",
  settingsReminders: "Przypomnienia",
  settingsRemindersTitle: "Przypomnienia",
  settingsRemindersEnableLabel: "Włącz przypomnienia",
  settingsLicense: "Licencja",
  settingsLicenseTitle: "Licencja",
  settingsLicenseBody:
    "Kup licencję premium HT Alchemy lub zarządzaj tutaj swoją obecną licencją.",
  settingsLicenseBuyButton: "Kup licencję",
  settingsLicenseRevokeButton: "Unieważnij licencję",
  settingsLicenseRevoked: "Licencja usunięta. Przywrócono tryb darmowy.",
  settingsLicenseRevokePending:
    "Unieważnienie licencji nie powiodło się. Spróbuj ponownie później.",
  settingsLicenseActivationSuccessTitle: "Licencja aktywowana",
  settingsLicenseActivationSuccessBody:
    "Twoja licencja premium HT Alchemy została aktywowana dla tej instancji aplikacji.",
  settingsLicenseExpiringWeekTitle: "Licencja wkrótce wygaśnie",
  settingsLicenseExpiringWeekBody:
    "Twoja licencja premium HT Alchemy wygaśnie za około 1 tydzień. Kup teraz nową subskrypcję, aby funkcje premium pozostały aktywne bez przerwy.",
  settingsLicenseExpiringDayTitle: "Licencja wkrótce wygaśnie",
  settingsLicenseExpiringDayBody:
    "Twoja licencja premium HT Alchemy wygaśnie za około 1 dzień. Kup teraz nową subskrypcję, aby funkcje premium pozostały aktywne bez przerwy.",
  settingsLicenseRenewButton: "Kup nową subskrypcję",
  settingsLicenseLimitExceededTitle: "Licencja obniżona",
  settingsLicenseLimitExceededBody:
    "Ta instancja aplikacji została obniżona do wersji darmowej, ponieważ przekroczono limit aktywacji licencji.",
  settingsLicenseRevocationSuccessTitle: "Licencja unieważniona",
  settingsLicenseRevocationSuccessBody:
    "Ta instancja aplikacji została odłączona od aktywnej licencji, a dostęp premium został usunięty.",
  settingsLicenseNoActive: "Brak aktywnej licencji.",
  settingsLicenseLoading: "Ładowanie szczegółów licencji…",
  settingsLicenseStatusLabel: "Bieżący status",
  settingsLicenseStatusActive: "Aktywna",
  settingsLicenseStatusInactive: "Nieaktywna",
  settingsLicenseStatusExpired: "Wygasła",
  settingsLicenseStatusDisabled: "Wyłączona",
  settingsLicenseDetailStatus: "Status licencji",
  settingsLicenseDetailKey: "Klucz licencji",
  settingsLicenseDetailActivationLimit: "Limit aktywacji",
  settingsLicenseDetailActivationUsage: "Wykorzystanie aktywacji",
  settingsLicenseDetailCreatedAt: "Utworzono",
  settingsLicenseDetailExpiresAt: "Wygasa",
  settingsLicenseDetailInstanceId: "ID instancji",
  settingsLicenseDetailInstanceName: "Nazwa instancji",
  settingsLicenseDetailInstanceCreatedAt: "Instancja utworzona",
  settingsLicenseDetailStoreId: "ID sklepu",
  settingsLicenseDetailOrderItemId: "ID pozycji zamówienia",
  settingsLicenseDetailProductId: "ID produktu",
  settingsLicenseDetailProduct: "Produkt",
  settingsLicenseDetailVariantId: "ID wariantu",
  settingsLicenseDetailVariant: "Wariant",
  settingsLicenseDetailOrderId: "ID zamówienia",
  settingsLicenseDetailCustomerId: "ID klienta",
  settingsLicenseDetailCustomerName: "Nazwa klienta",
  settingsLicenseDetailCustomerEmail: "E-mail klienta",
  settingsLicenseNeverExpires: "Nigdy",
  settingsGeneralExportAllLabel: "Eksportuj wszystkie ustawienia",
  settingsGeneralExportAllHint:
    "Eksportuje wszystkie lokalnie zapisane ustawienia aplikacji i stan pamięci podręcznej do pliku kopii zapasowej JSON.",
  settingsGeneralImportAllLabel: "Importuj wszystkie ustawienia",
  settingsGeneralImportAllHint:
    "Importuje wcześniej wyeksportowaną kopię zapasową JSON i zastępuje bieżące lokalne ustawienia aplikacji oraz stan pamięci podręcznej.",
  settingsStorageManagementButton: "Zarządzanie pamięcią",
  settingsStorageManagementTitle: "Zarządzanie pamięcią",
  settingsStorageManagementTotalUsed: "Użyta pamięć: {{size}}",
  settingsStorageManagementKeyColumn: "Klucz",
  settingsStorageManagementUsageColumn: "Użycie",
  settingsStorageManagementActionColumn: "Akcja",
  settingsStorageManagementWipeButton: "Wyczyść",
  settingsStorageManagementNoKeys: "Nie znaleziono kluczy localStorage.",
  settingsStorageManagementWipeConfirmTitle: "Wyczyścić klucz pamięci?",
  settingsStorageManagementWipeConfirmBody:
    'Zamierzasz wyczyścić "{{key}}" z pamięci lokalnej. Po wyczyszczeniu nie można tego cofnąć. Dane aplikacji, ustawienia, pamięć podręczna lub stan zapisane pod tym kluczem mogą zostać utracone.',
  settingsStorageManagementWipeSuccess: "Wyczyszczono klucz pamięci: {{key}}",
  settingsStorageManagementWipeError:
    "Nie udało się wyczyścić klucza pamięci: {{key}}",
  settingsStorageManagementReadError: "Nie udało się odczytać localStorage.",
  settingsMachineLearningTitle: "Uczenie maszynowe",
  settingsMachineLearningBody:
    "Migawki seniorów są uczone automatycznie z odświeżeń seniorów i szczegółów wyników rynku transferowego.",
  settingsMachineLearningInfoLabel: "Informacje o modelu",
  settingsMachineLearningInfoHint:
    "Pokazuje liczbę zanonimizowanych migawek seniorów oraz to, co model lokalny może przewidywać.",
  settingsMachineLearningTestLabel: "Testuj model seniorów",
  settingsMachineLearningTestingLabel: "Testowanie modelu seniorów…",
  settingsMachineLearningTestHint:
    "Ocenia lokalny model seniorów na twoich własnych seniorach, pomijając identyczne migawki.",
  seniorMlInfoTitle: "Informacje o modelu seniorów",
  seniorMlModelTypeLabel: "Typ modelu",
  seniorMlModelTypeValue: "Lokalna regresja K najbliższych sąsiadów",
  seniorMlSampleCountLabel: "Migawki treningowe",
  seniorMlDistinctPlayersLabel: "Unikalni zawodnicy",
  seniorMlSourcesLabel: "Źródła",
  seniorMlLastUpdatedLabel: "Ostatnia aktualizacja",
  seniorMlTargetsLabel: "Cele",
  seniorMlTargetsValue: "TSI, pensja, wiek",
  seniorMlNoData:
    "Nie zebrano jeszcze migawek seniorów. Odśwież seniorów albo uruchom wyszukiwania transferów.",
  seniorMlSourceOwnSenior: "Własni seniorzy",
  seniorMlSourceSeniorMarket: "Rynek seniorów",
  seniorMlSourceYouthMarket: "Rynek wyceny juniorów",
  seniorMlEvaluationTitle: "Test modelu seniorów",
  seniorMlEvaluationEmpty: "Nie uruchomiono jeszcze oceny.",
  seniorMlEvaluationNotReady:
    "Nie ma jeszcze dość danych seniorów, aby przetestować model na twoich zawodnikach.",
  seniorMlEvaluationTestedCount: "Testowani zawodnicy",
  seniorMlEvaluationTsiMae: "Średni błąd TSI",
  seniorMlEvaluationWageMae: "Średni błąd pensji",
  seniorMlEvaluationAgeMae: "Średni błąd wieku",
  seniorMlEvaluationAgeDays: "{{days}} dni",
  notificationSeniorMlEvaluationFailed: "Test modelu seniorów nie powiódł się.",
  settingsGeneralChronicleWatchlistsExportLabel:
    "Eksportuj listy obserwowanych Club Chronicle na telefon",
  settingsGeneralChronicleWatchlistsExportHint:
    "Tworzy kod QR z listami obserwowanych Club Chronicle do importu na innym urządzeniu.",
  settingsGeneralChronicleWatchlistsImportLabel: "Importuj listy CC",
  settingsGeneralChronicleWatchlistsImportHint:
    "Użyj natywnego aparatu telefonu, aby otworzyć wyeksportowany kod QR z listami obserwowanych Club Chronicle.",
  analyticsConsentModalTitle: "Analytics consent",
  analyticsConsentModalBody:
    "We want to improve this app by analyzing how it is being used. This helps us understand app and feature usage, make better product decisions, and prioritize useful future changes.\n\nWe do not send names, email addresses, Hattrick tokens, player names, team names, or other directly identifying information. Analytics data is used only in aggregated form for product-improvement purposes.",
  analyticsConsentDeniedAction: "Do not consent",
  analyticsConsentGrantedAction: "Consent",
  settingsAnalyticsConsentTitle: "Analytics consent",
  settingsAnalyticsConsentDescription:
    "Control whether this app may analyze app and feature usage to support product-improvement decisions.",
  settingsAnalyticsConsentStatusGranted: "Current choice: Consent granted",
  settingsAnalyticsConsentStatusDenied: "Current choice: Consent denied",
  settingsAnalyticsConsentStatusUnset: "No choice saved",
  settingsAnalyticsConsentGrantButton: "Consent",
  settingsAnalyticsConsentDenyButton: "Do not consent",
  settingsChronicleQrExportTitle:
    "Eksport list obserwowanych Club Chronicle na telefon",
  settingsChronicleQrExportBody:
    "Zeskanuj ten kod QR natywnym aparatem telefonu, aby zaimportować wszystkie listy obserwowanych Club Chronicle na telefon.",
  settingsChronicleQrExportSummaryTitle: "Ten kod QR eksportuje:",
  settingsChronicleQrExportFailed:
    "Nie udało się wygenerować kodu QR dla list obserwowanych Club Chronicle.",
  settingsChronicleQrImportTitle:
    "Import list obserwowanych Club Chronicle",
  settingsChronicleQrImportBody:
    "Zeskanuj wyeksportowany kod QR z listami obserwowanych Club Chronicle natywnym aparatem telefonu. Po otwarciu linku aplikacja zapyta, czy chcesz zastąpić bieżące listy na tym urządzeniu.",
  settingsChronicleQrImportScanning: "Skanowanie kodu QR…",
  settingsChronicleQrImportUnsupported:
    "Skanowanie QR kamerą nie jest obsługiwane w tej przeglądarce.",
  settingsChronicleQrImportPermissionDenied:
    "Odmówiono dostępu do kamery. Zezwól na kamerę, aby zeskanować kod QR.",
  settingsChronicleQrImportFailed:
    "Nie udało się odczytać prawidłowego kodu QR z listami obserwowanych Club Chronicle.",
  settingsChronicleQrImportSuccess:
    "Listy obserwowanych Club Chronicle zostały zaimportowane.",
  settingsChronicleQrImportWarningTitle:
    "Zastąpić listy obserwowanych Club Chronicle",
  settingsChronicleQrImportWarningBody:
    "Import tego kodu QR zastąpi bieżące listy obserwowanych Club Chronicle na tym urządzeniu. Kontynuować?",
  settingsChronicleQrImportConfirm: "Zastąp listy",
  settingsChronicleQrImportTabsSummaryLabel: "Karty",
  settingsChronicleQrImportDirectTeamsSummaryLabel: "Zespoły bezpośrednie",
  settingsChronicleQrImportOwnLeaguesSummaryLabel: "Własne ligi",
  settingsChronicleQrImportManualTeamsSummaryLabel: "Zespoły ręczne",
  settingsDebug: "Diagnostyka",
  settingsDebugTitle: "Ustawienia diagnostyki",
  betaPillLabel: "Beta",
  betaPillTooltip:
    "Ta aplikacja jest w wersji beta. Funkcje, zachowanie i lokalnie zapisane dane podręczne mogą zmieniać się lub być resetowane bez wcześniejszej zapowiedzi.",
  freePillLabel: "Free",
  freePillTooltip:
    "Tryb darmowy. Funkcje premium pozostają zablokowane, dopóki nie zostanie aktywowana ważna licencja. Kliknij, aby kupić licencję premium.",
  premiumPillLabel: "Premium",
  premiumPillTooltip: "Licencja premium odblokowana. Kliknij, aby zobaczyć szczegóły licencji.",
  updateRequiredTitle: "Wymagana aktualizacja",
  updateRequiredBody:
    "Dostepna jest nowa wersja HT Alchemy. Odswiez teraz, aby dalej korzystac z aplikacji.",
  updateRequiredAction: "Odswiez",
  changelog_6_0_0:
    "Dodano globalny framework przypomnień z ustawieniami, ikoną, odkładaniem/ukrywaniem oraz eksportem/importem.",
  changelog_5_8_0:
    "Introduced Google Analytics and Vercel Analytics loading behind explicit user consent.",
  changelog_5_7_0:
    "HatStats (zrodlo: Foxtrick) sa teraz uwzglednione w analizie przeciwnika.",
  changelog_5_6_0:
    "Rozszerzone szczegoly zawodnikow w panelach TSI i plac w Club Chronicle.",
  changelog_5_5_0:
    "Wlasne ligi w Club Chronicle rozwijaja sie teraz do wyboru zespolow z przelacznikami grupowymi dla ligi.",
  changelog_5_4_0:
    "Club Chronicle wymusza teraz limity zasobow, zachowujac ukryte zapisane karty i zespoly bez pobierania danych ukrytych zespolow.",
  changelog_5_3_0:
    "HT Alchemy wykrywa teraz nowsze wdrozone wersje i wymaga odswiezenia z pominieciem pamieci podrecznej.",
  changelog_5_2_0:
    "Kryteria porownania transferowego mozna teraz wylaczyc za pomoca - zarowno przy wycenie juniorow, jak i w seniorskim wyszukiwaniu podobnych zawodnikow.",
  changelog_5_1_0:
    "Seniorzy wystawieni na liste transferowa pokazuja teraz spójne oznaczenia i zapisane w pamięci szczegoly sprzedazy we wszystkich widokach seniorow.",
  changelog_5_0_0: "Blokowanie funkcji.",
  changelog_4_14_0:
    "Macierz ocen seniorów obsługuje teraz ręczne nadpisywanie ocen z bezpiecznym przywracaniem po odświeżeniu.",
  changelog_4_13_0:
    "W skladach juniorow i seniorow klikniecie pustego pola pokazuje teraz zawodnikow uszeregowanych wedlug przydatnosci.",
  changelog_4_12_0:
      "Club Chronicle now includes a Team Attitude panel that flags likely PIC and MOTS matches.",
  changelog_4_11_0:
      "Transfer market search now has a table view with dense desktop/mobile scanning and quick bidding.",
    changelog_4_10_0:
    "Wartosci FoxTrick mozna teraz symulowac przez edycje umiejetnosci seniora, wieku i pensji w szczegolach zawodnika oraz wynikach wyszukiwania transferow.",
  changelog_4_9_0:
    "Szczegoly seniorow i wyniki wyszukiwania transferow pokazuja teraz wartosci HTMS i PsicoTSI.",
  changelog_4_8_0:
    "Club Chronicle moze teraz usuwac zakonczone mecze z Hattrick Live w panelu trwajacych meczow.",
  changelog_4_7_0:
    "Panele Club Chronicle na desktopie mozna teraz ukrywac i przywracac z menu widocznosci.",
  changelog_4_6_0:
    "Wyszukiwania na rynku transferowym maja teraz kompaktowe podsumowanie i rozklad cen.",
  changelog_4_5_0:
    "Szczegoly juniorow moga teraz szacowac wartosc transferowa z odkrytego maksymalnego potencjalu.",
  changelog_4_4_0:
    "Club Chronicle może teraz śledzić trwające mecze z opcjonalną obsługą turniejów.",
  changelog_4_3_0:
    "Szczegóły seniorów pokazują teraz flagi pochodzenia z zapisanych danych świata.",
  changelog_4_2_0:
    "Analiza rywala pokazuje teraz srednie oceny sektorow dla kazdego sprawdzanego meczu.",
  changelog_4_1_0:
    "Listy obserwowanych w Club Chronicle można teraz przenosić między urządzeniami przez eksport QR na desktopie/mobilu i import kamerą na mobile.",
  changelog_4_0_0:
    "HT Alchemy ma teraz dedykowane wsparcie mobilne w całej aplikacji.",
  changelog_3_13_0:
    "Senior AI obsluguje teraz wykrywanie krycia indywidualnego, wysylke zlecenia i podsumowanie po wyslaniu.",
  changelog_3_12_0:
    "Szczegoly zawodnika seniora zawieraja teraz wyszukiwanie podobnych graczy na rynku transferowym z edytowalnymi filtrami i licytacja dla Supporterow.",
  changelog_3_11_0:
    "Dostepnosc skladu B seniorow zalezy teraz od okien meczow skladu A i B w biezacym tygodniu zamiast od stalej blokady weekendowej.",
  changelog_3_10_0:
    "Club Chronicle dodaje panel Power ratings z danych teamdetails w pamięci podręcznej wraz z rozbiciem rankingów.",
  changelog_3_9_0:
    "Club Chronicle obsługuje teraz karty z niezależnymi listami obserwowanych i aktualizacjami ograniczonymi do danej karty.",
  changelog_3_8_0:
    "Watchlista Club Chronicle może teraz opcjonalnie rozszerzać twoje własne ligi, aby śledzić pozostałe drużyny w każdej z nich.",
  changelog_3_7_0:
    "Senior AI dodaje optymalizację pod stałą formację, która testuje wszystkie taktyki i wybiera najlepszą.",
  refresh: "Odśwież",
  refreshTooltip: "Odśwież dane juniorów",
  refreshAllYouthDataTooltip: "Odśwież wszystkie dane juniorów.",
  refreshAllSeniorDataTooltip: "Odśwież wszystkie dane seniorów.",
  startupLoadingTitle: "Przygotowywanie obszaru roboczego…",
  startupLoadingSubtitle: "Pierwsze ładowanie może chwilę potrwać.",
  startupLoadingTeamContext: "Ładowanie kontekstu drużyny…",
  startupLoadingPlayers: "Ładowanie zawodników…",
  startupLoadingMatches: "Ładowanie meczów…",
  startupLoadingRatings: "Ładowanie ocen…",
  startupLoadingFinalize: "Finalizowanie interfejsu…",
  unableToLoadPlayers:
    "Nie udalo sie zaladowac zawodnikow. Sprobuj rozlaczyc i polaczyc ponownie ze swiezym tokenem.",
  refreshStatusFetchingPlayers: "Pobieranie juniorów…",
  refreshStatusFetchingPlayerDetails: "Pobieranie szczegółów zawodników…",
  refreshStatusFetchingMatches: "Pobieranie meczów…",
  refreshStatusFetchingRatings: "Pobieranie ocen z poprzednich meczów…",
  refreshStatusFetchingPastMatchesProgress:
    "Pobieranie poprzednich meczów {completed}/{total}…",
  refreshStatusFetchingHiddenSpecialties: "Wykrywanie ukrytych specjalności…",
  refreshStatusFetchingHiddenSpecialtiesProgress:
    "Wykrywanie ukrytych specjalności {completed}/{total}…",
  refreshStopButton: "Zatrzymaj",
  refreshStopTooltip: "Zatrzymaj trwające odświeżanie",
  youthLastGlobalRefresh: "Ostatnie globalne odświeżenie",
  youthPlayerList: "Lista juniorów",
  noYouthPlayers: "Brak juniorów.",
  assigned: "PRZYPISANY",
  playerDetails: "Szczegóły zawodnika",
  detailsTabLabel: "Szczegóły",
  skillsMatrixTabLabel: "Macierz umiejętności",
  ratingsMatrixTabLabel: "Macierz ocen",
  seniorSkillsMatrixBonusToggleLabel: "Efektywna umiejętność",
  seniorSkillsMatrixBonusToggleTooltip:
    "Włącz, aby pokazać efektywną umiejętność uwzględniającą lojalność, bonus klubu macierzystego i formę.",
  ratingsTitle: "Macierz ocen",
  ratingsMatchesAnalyzed: "Dane pobrane z {count} meczów.",
  ratingsLastAppliedMatchLabel:
    "Ostatnio zastosowane oceny z końca meczu (85-96 rozegranych minut) z meczu {matchId} o {dateTime}.",
  ratingsManualOverrideToggle: "Ręcznie edytuj oceny",
  ratingsManualOverrideTooltip:
    "Oceny są używane do ustawiania zawodników w składach AI. Włącz to, aby ręcznie zmieniać oceny. Przydatne, jeśli chcesz wymusić, by zawodnik został wybrany albo nie wybrany na konkretną pozycję niezależnie od formy i wcześniejszych występów.",
  ratingsManualOverridePremiumTooltip:
    "Kup licencję premium HT Alchemy, aby ręcznie edytować oceny używane przez AI od składów seniorów.",
  ratingsOverwriteManualEditsToggle: "Nadpisuj ręcznie edytowane oceny",
  ratingsOverwriteManualEditsTooltip:
    "Po włączeniu nowo pobrane oceny zastąpią wszystkie oceny edytowane ręcznie przy następnym odświeżeniu macierzy.",
  ratingsDiscardManualEditsButton: "Odrzuć ręczne edycje",
  ratingsManualEditCellLabel: "Ustaw ocenę dla {player} na pozycji {position}",
  ratingsManualEditedIndicator: "Ocena edytowana ręcznie",
  ratingsIndexLabel: "#",
  ratingsSortBy: "Sortuj wg",
  ratingsPlayerLabel: "Zawodnik",
  ratingsSpecialtyLabel: "Specjalność",
  ratingSectorMidfieldShort: "ŚR",
  ratingSectorRightDefShort: "OP",
  ratingSectorMidDefShort: "OŚ",
  ratingSectorLeftDefShort: "OL",
  ratingSectorRightAttShort: "AP",
  ratingSectorMidAttShort: "AŚ",
  ratingSectorLeftAttShort: "AL",
  averageLabel: "Średnia",
  matrixNewPillLabel: "NOWE",
  matrixNewNTooltip: "Nowo odkryte / zmienione po odświeżeniu",
  scoutImportantSkillTooltip: "Umiejętność z top 3",
  scoutOverallSkillLevelTooltip: "Ogólny poziom umiejętności",
  sortLabel: "Sortuj wg",
  sortName: "Nazwisko",
  sortAge: "Wiek",
  sortPromotionAge: "Wiek przy awansie",
  sortArrival: "Przyjście",
  sortPromotable: "Do awansu",
  sortKeeper: "Bronienie",
  sortDefender: "Defensywa",
  sortPlaymaker: "Rozgrywanie",
  sortWinger: "Dośrodkowania",
  sortPassing: "Podania",
  sortScorer: "Skuteczność",
  sortSetPieces: "St. fragmenty",
  sortTsi: "TSI",
  sortWage: "Pensja",
  sortForm: "Forma",
  sortStamina: "Kondycja",
  sortExperience: "Doświadczenie",
  sortLoyalty: "Lojalność",
  seniorCareerStatsTitle: "Statystyki kariery i drużyny",
  seniorCareerGoalsLabel: "Bramki w karierze",
  seniorCareerHattricksLabel: "Hat-tricki w karierze",
  seniorLeagueGoalsLabel: "Bramki ligowe (w tym sezonie)",
  seniorCupGoalsLabel: "Bramki pucharowe (w tym sezonie)",
  seniorFriendliesGoalsLabel: "Bramki w sparingach (sezon)",
  seniorCapsLabel: "Występy w reprezentacji",
  seniorCapsU20Label: "Występy w U-20",
  seniorGoalsCurrentTeamLabel: "Bramki dla obecnej drużyny",
  seniorAssistsCurrentTeamLabel: "Asysty dla obecnej drużyny",
  seniorCareerAssistsLabel: "Asysty w karierze",
  seniorMatchesCurrentTeamLabel: "Mecze dla obecnej drużyny",
  sortInjuries: "Kontuzje",
  sortCards: "Kartki",
  sortCustom: "--",
  sortToggleAria: "Odwróć kierunek sortowania",
  sortAscLabel: "Rosnąco",
  sortDescLabel: "Malejąco",
  seniorPlayerListTitle: "Zawodnicy seniorów",
  seniorTransferSearchButtonLabel: "Znajdz podobnych graczy",
  seniorTransferSearchEditedButtonLabel:
    "Znajdz podobnego gracza z edytowanymi wartosciami",
  seniorTransferSearchFemaleTeamTooltip:
    "Wyszukiwanie na rynku transferowym nie jest dostepne dla druzyn femme.",
  seniorTransferSearchModalTitle: "Wyszukiwanie transferowe",
  seniorTransferSearchCriteriaTitle: "Kryteria wyszukiwania",
  seniorTransferSearchResultsTitle: "Wyniki",
  seniorTransferSearchSourcePlayerLabel: "Na podstawie {{player}}",
  seniorTransferSearchMinLabel: "Min",
  seniorTransferSearchMaxLabel: "Max",
  seniorTransferSearchAnySpecialtyLabel: "Dowolna",
  seniorTransferSearchAgeRangeLabel: "Wiek",
  seniorTransferSearchTsiRangeLabel: "TSI",
  seniorTransferSearchPriceRangeLabel: "Cena (EUR)",
  seniorTransferSearchSearchButton: "Szukaj",
  seniorTransferSearchCloseButton: "Zamknij",
  seniorTransferSearchLoading: "Trwa wyszukiwanie na rynku transferowym…",
  seniorTransferSearchNoResults:
    "Brak zawodnikow na liscie transferowej spelniajacych te kryteria.",
  seniorTransferSearchFallbackNotice:
    "Dokladne wyszukiwanie umiejetnosci nic nie zwrocilo. Automatycznie uruchomiono szersze wyszukiwanie z obnizonymi minimami o 1, wiekiem rozszerzonym do ±50 dni i bez filtra specjalnosci.",
  youthEstimateValueFallbackNotice:
    "Dokladne wyszukiwanie wyceny nic nie zwrocilo. Uruchomiono szersze wyszukiwanie z oknem wieku awansu rozszerzonym do ±50 dni i bez filtra specjalnosci.",
  seniorTransferSearchResultsCount: "{{count}} wynikow",
  seniorTransferSearchResultsMany: "Wiele wynikow",
  seniorTransferSearchHighestBidLabel: "Najwyzsza oferta",
  seniorTransferSearchDeadlineLabel: "Koniec aukcji",
  seniorTransferListedIndicatorLabel: "Wystawiony na liste transferowa",
  seniorTransferListedNoBidsYet: "Brak ofert",
  seniorTransferSearchSellerLabel: "Sprzedajacy",
  seniorTransferSearchBidAmountLabel: "Kwota oferty (EUR)",
  seniorTransferSearchMaxBidAmountLabel: "Maks. oferta (EUR)",
  seniorTransferSearchPlaceBidButton: "Zloz oferte",
  seniorTransferSearchPlaceMaxBidButton: "Ustaw maks. oferte",
  seniorTransferSearchSupporterOnlyTooltip:
    "Ta akcja jest dostepna tylko dla Supporterow Hattrick.",
  hattrickSupporterActionRequiredTooltip:
    "Ta akcja jest dostepna tylko dla Supporterow Hattrick.",
  seniorTransferSearchBidMissingAmount: "Najpierw wpisz kwote oferty.",
  seniorTransferSearchBidPlaced: "Zlozono oferte na {{player}}.",
  seniorTransferSearchBidFailed: "Oferta nie powiodla sie: {{details}}",
  youthEstimateValueButton: "Oszacuj wartosc",
  youthEstimateValueTooltip:
    "Przeszukaj rynek transferowy na podstawie maksymalnego potencjalu tego zawodnika.",
  youthEstimateValuePremiumTooltip:
    "Kup licencję premium HT Alchemy, aby użyć funkcji oszacowania wartości.",
  youthEstimateValueDisabledTooltip:
    "Odkryj co najmniej jeden maksymalny potencjal umiejetnosci przed oszacowaniem wartosci.",
  youthEstimateValueAgeMissingTooltip:
    "Odswiez szczegoly zawodnika przed oszacowaniem wartosci.",
  transferSearchSortDefault: "Kolejnosc oryginalna",
  transferSearchSortHtmsPotential: "Potencjal HTMS",
  transferSearchSortPsicoTsiAverage: "Srednia prognoza Psico oparta na TSI",
  transferSearchSortPsicoWageAverage: "Srednia prognoza Psico oparta na placy",
    transferSearchShowTableButton: "Show table",
    transferSearchShowCardsButton: "Back to cards",
    transferSearchTableNationalityColumn: "Nat",
    transferSearchTableNameColumn: "Name",
    transferSearchTableSpecialtyColumn: "Spec",
    transferSearchTableInjuryColumn: "Inj",
    transferSearchTableAgeColumn: "Age",
    transferSearchTablePriceColumn: "HB/AP",
    transferSearchTableLeadershipColumn: "Ld",
    transferSearchTableExperienceColumn: "XP",
    transferSearchTableFormColumn: "Form",
    transferSearchTableStaminaColumn: "Stam",
    transferSearchTableKeeperColumn: "KP",
    transferSearchTableDefendingColumn: "Def",
    transferSearchTablePlaymakingColumn: "PM",
    transferSearchTableWingerColumn: "W",
    transferSearchTablePassingColumn: "Ps",
    transferSearchTableScoringColumn: "Sc",
    transferSearchTableSetPiecesColumn: "SP",
    transferSearchTableHtmsColumn: "HTMS",
    transferSearchTablePsicoTsiColumn: "Psico TSI",
    transferSearchTablePsicoWageColumn: "Psico wage",
    transferSearchTableWageColumn: "Wage",
    transferSearchTableDeadlineColumn: "Left",
    transferSearchTableBidColumn: "Bid",
    transferSearchTableBidAction: "Bid",
    transferSearchTablePriceFootnote: "HB = najwyzsza oferta. AP = cena wywolawcza.",
    transferSearchTableWageFootnote: "* zawiera dodatek obcokrajowca wzgledem twojej druzyny.",
    notificationDebugTransferWageContext:
      "Debug: liga wybranej druzyny {{selectedLeagueId}}",
    notificationDebugTransferWagePlayer:
      "Debug: {{name}} rodzima liga {{nativeLeagueId}}, za granica {{isAbroad}}, obcy wzgledem druzyny {{foreign}}, placa {{salarySek}}, skorygowana {{adjustedSalarySek}}",
    transferSearchDeadlineNowShort: "now",
    transferSearchDeadlineDayShort: "d",
    transferSearchDeadlineHourShort: "h",
    transferSearchDeadlineMinuteShort: "m",
  transferSearchMarketSummaryTitle: "Podsumowanie rynku",
  transferSearchMarketSummaryBasis: "{{count}} wynikow z cena",
  transferSearchMarketSummarySparse:
    "Tylko {{count}} wynikow z cena; traktuj to jako przyblizony sygnal.",
  transferSearchMarketSummaryNoPrices:
    "Brak wynikow z cena do podsumowania.",
  transferSearchMarketRangeLabel: "Zakres",
  transferSearchMarketMedianLabel: "Mediana",
  transferSearchMarketMeanLabel: "Srednia",
  transferSearchMarketMiddleLabel: "Srodkowe 50%",
  transferSearchMarketDistributionLabel: "Rozklad cen",
  seniorListInjuryBruised: "Stłuczony",
  seniorListInjuryWeeks: "Kontuzjowany ({weeks} tyg.)",
  seniorCardsMatchRunning: "mecz w toku",
  statusLabel: "Status",
  matchStatusUpcoming: "Nadchodzący",
  matchStatusFinished: "Zakończony",
  matchStatusOngoing: "W trakcie",
  matchesTitle: "Mecze",
  matchesRefreshTooltip: "Odśwież mecze",
  matchesIncludeTournamentLabel: "Uwzględnij mecze turniejowe",
  matchesIncludeTournamentTooltip: "Pokaż także mecze turniejowe.",
  noUpcomingMatches: "Brak nadchodzących meczów.",
  noMatchesReturned: "Brak zwróconych meczów.",
  ordersLabel: "Polecenia",
  ordersSet: "Ustawione",
  ordersNotSet: "Nie ustawione",
  loadLineup: "Wczytaj skład",
  loadLineupLoading: "Wczytywanie…",
  setBestLineup: "Ustaw najlepszy skład",
  setBestLineupLoading: "Ustawianie…",
  setBestLineupTooltip: "Ustawia skład przy użyciu sztucznej inteligencji.",
  setBestLineupTrainingAware: "Uwzględnij trening",
  setBestLineupTrainingAwareTooltip:
    "Ustaw skład z uwzględnieniem reżimu treningowego. Brane są pod uwagę tylko formacje, które wypełniają wszystkie sloty treningowe.",
  setBestLineupIgnoreTraining: "Ignoruj trening",
  setBestLineupIgnoreTrainingTooltip:
    "Ustaw skład bez uwzględniania reżimu treningowego. Wybierz między dopuszczeniem wszystkich formacji a tylko trenowanych formacji.",
  setBestLineupIgnoreTrainingAllowAllFormations: "Zezwól na wszystkie formacje",
  setBestLineupIgnoreTrainingAllowOnlyTrainedFormations:
    "Zezwól tylko na trenowane formacje",
  setBestLineupAimForExtraTime: "Graj pod dogrywkę",
  setBestLineupAimForExtraTimeTooltip:
    "Gra na remis, aby zyskać dodatkowy trening.",
  setBestLineupAimForExtraTimeDisabledTooltip:
    "Dostępne tylko dla Baraży, Pucharu i sparingów z zasadami pucharowymi.",
  setBestLineupOptimizeByFormation: "Optymalizuj pod {{formation}}",
  setBestLineupOptimizeByFormationTooltip:
    "Najpierw zablokuj formację, przypisz do niej najlepiej ocenianych zawodników, a potem przetestuj wszystkie taktyki i zachowaj najlepszy wynik.",
  setBestLineupOptimizeByFormationDisabledTooltip:
    "Najpierw wybierz formację.",
  setBestLineupOptimizeByFormationUnavailable:
    "Nie udało się zbudować pełnego składu dla tej formacji z dostępnych zawodników.",
  setBestLineupOptimizeByFormationApply: "Zastosuj optymalizację formacji",
  seniorLineupAiEligibilityNeed18Tooltip:
    "Do użycia narzędzi AI składu potrzeba 18 uprawnionych zawodników.",
  seniorLineupAiEligibilityRelaxAlreadyPlayedTooltip:
    "Poluzuj limit rozegranych minut, aby zwiększyć pulę do 18 uprawnionych zawodników.",
  seniorLineupAiEligibilityRelaxLastMatchTooltip:
    "Poluzuj ustawienie ostatniego meczu, aby zwiększyć pulę do 18 uprawnionych zawodników.",
  seniorLineupAiEligibilityRelaxBothTooltip:
    "Poluzuj ustawienia rozegranych minut i ostatniego meczu, aby zwiększyć pulę do 18 uprawnionych zawodników.",
  seniorFixedFormationTotalRatingsLabel: "Suma ocen",
  seniorFixedFormationWeightedSumLabel: "Suma ważona",
  seniorExtraTimeModalTitle: "Dlaczego warto grać pod dogrywkę?",
  seniorExtraTimeModalLead:
    "Bo dogrywka może dać dodatkowe minuty treningowe.",
  seniorExtraTimeModalTrainingLimit:
    "W Hattrick każdy zawodnik może otrzymać maksymalnie 90 minut treningu tygodniowo.",
  seniorExtraTimeModalRotation:
    "Jeśli mecz wejdzie w dogrywkę i wprowadzisz innych zawodników na pozycje treningowe, te minuty mogą przełożyć się na dodatkowy trening.",
  seniorExtraTimeModal120CupPrefix:
    "Istnieje nawet rozgrywka oparta dokładnie na tym pomyśle:",
  seniorExtraTimeModal120CupLinkLabel: "Puchar 120%",
  seniorExtraTimeModal120CupMiddle: "organizowany przez",
  seniorExtraTimeModalMonomorphLinkLabel: "monomorph",
  seniorExtraTimeModalWorkflow:
    "To bardzo proste: na podstawie reżimu treningowego Alchemy poprosi Cię o wybór zawodników do treningu. Wskazujesz zawodników, klikasz Ustaw najlepszy skład, a Alchemy zajmuje się resztą (ustawianiem pozycji i orientacji zawodników, doborem taktyki, konfiguracją zmian, ustawieniem wykonawców rzutów karnych, wyborem wykonawcy stałych fragmentów gry itd.). Gdy będziesz zadowolony ze składu, kliknij Wyślij skład, aby wysłać go do Hattricka. Szanse na remis są znacznie większe, jeśli przeciwnik również ustawi skład w podobny sposób.",
  seniorExtraTimeModalChooseTrainees:
    "Wybierz {{count}} trenowanych zawodników, a następnie kliknij Ustaw skład. Zaznaczonych automatycznie można zmienić.",
  seniorExtraTimeModalBTeamToggleLabel: "Drugi skład",
  seniorAiLastMatchThresholdText:
    "Pomijaj zawodników, których ostatni mecz był dawniej niż {{weeks}} tygodni temu.",
  seniorAiLastMatchThresholdDisabledText:
    "Ignoruj zawodników, których ostatni mecz był ponad {{weeks}} tygodni temu.",
  seniorAiLastMatchThresholdAriaLabel:
    "Próg tygodni do pomijania zawodników według daty ostatniego meczu",
  seniorAiLastMatchDisregardedTooltip:
    "Ten zawodnik jest pomijany, ponieważ ostatni raz grał {{weeks}} tygodni temu.",
  seniorAiRedCardedDisregardedTooltip:
    "Ten zawodnik jest pomijany, ponieważ pauzuje po czerwonej kartce.",
  seniorAiManMarkingToggleLabel: "Krycie indywidualne",
  seniorAiManMarkingToggleTooltip:
    "Wyslij polecenia krycia indywidualnego, jesli zostana zidentyfikowani odpowiedni kryjacy i odpowiedni cel krycia.",
  seniorAiManMarkingPremiumTooltip:
    "Kup licencję premium HT Alchemy, aby używać krycia indywidualnego w optymalizacji składu seniorów.",
  seniorAiManMarkingFuzzinessLabel: "Rygor MM",
  seniorAiManMarkingFuzzinessTooltip:
    "Surowosc identyfikacji celu krycia indywidualnego.",
  seniorAiManMarkingFuzzinessAriaLabel:
    "Surowosc identyfikacji celu krycia indywidualnego",
  seniorAiManMarkingFuzzinessPremiumTooltip:
    "Kup licencję premium HT Alchemy, aby regulować surowość krycia indywidualnego w optymalizacji składu seniorów.",
  seniorAiManMarkingNeedsLineupTooltip:
    "Krycie indywidualne można włączyć dopiero po ustawieniu składu oraz po zidentyfikowaniu kryjącego i celu krycia.",
  seniorAiManMarkingEnabledTooltip:
    "Włącz krycie indywidualne {{target}} przez {{marker}}.",
  seniorAiManMarkingMissingMarkerTooltip:
    "Nie zidentyfikowano odpowiedniego kryjącego.",
  seniorAiManMarkingMissingTargetTooltip:
    "Nie zidentyfikowano odpowiedniego celu krycia indywidualnego.",
  seniorAiManMarkingMissingBothTooltip:
    "Nie zidentyfikowano ani odpowiedniego kryjącego, ani celu krycia indywidualnego.",
  seniorExtraTimeModalBTeamThresholdText:
    "Pomijaj zawodników, którzy już zagrali {{minutes}} minut {{weekLink}}.",
  seniorExtraTimeModalBTeamThresholdWeekLinkLabel: "w tym tygodniu",
  seniorExtraTimeModalBTeamThresholdAriaLabel:
    "Próg minut do pomijania zawodników, którzy już grali w tym tygodniu",
  seniorExtraTimeModalBTeamNoRecentMatch:
    "Nie znaleziono meczu skladu A przydatnego treningowo dla tego tygodnia.",
  seniorExtraTimeModalBTeamLoading:
    "Sprawdzanie meczów istotnych dla treningu w tym tygodniu...",
  seniorExtraTimeModalBTeamError:
    "Nie udało się sprawdzić meczów istotnych dla treningu w tym tygodniu.",
  seniorExtraTimeModalBTeamWeekendTooltip:
    "Wybór składu B jest dostępny tylko od poniedziałku do czwartku (CET).",
  seniorExtraTimeModalBTeamEnabledTooltip:
    "Wlacz, aby przygotowac sklad z pominieciem zawodnikow, ktorzy rozegrali juz mecz w tym tygodniu.",
  seniorExtraTimeModalBTeamNoATeamMatchTooltip:
    "Jak dotad w tym tygodniu nie wykryto meczu skladu A.",
  seniorExtraTimeModalBTeamAlreadyPlayedTooltip:
    "Mecz skladu B zostal juz rozegrany w tym tygodniu: {{matchLink}}.",
  seniorExtraTimeModalBTeamAlreadyPlayedDisabledTooltip:
    "Mecz skladu B zostal juz rozegrany w tym tygodniu.",
  seniorExtraTimeModalBTeamAlreadyPlayedLinkLabel: "mecz",
  seniorExtraTimeModalBTeamDisregardedTooltip:
    "Ten zawodnik jest pomijany, ponieważ w tym tygodniu rozegrał już co najmniej {{minutes}} minut.",
  seniorExtraTimeModalSetLineupButton: "Ustaw skład",
  seniorExtraTimeModalSetLineupDisabledTooltip:
    "Wybierz właściwą liczbę trenowanych zawodników, aby ustawić skład.",
  seniorExtraTimeModalSetLineupReadyTooltip:
    "Kliknij Wyślij skład na odpowiedniej karcie meczu, aby wysłać skład do Hattricka.",
  setBestLineupRejectedPlayersLabel: "Odrzuceni zawodnicy",
  setBestLineupIneligiblePlayersLabel: "Nieuprawnieni zawodnicy",
  setBestLineupDevAssignmentTraceLabel: "Ślad przypisań",
  setBestLineupDevEligiblePlayersLabel: "Uprawnieni zawodnicy",
  setBestLineupDevUnfilledLabel: "Nieobsadzone",
  setBestLineupDevNoSlotRatingLabel: "Brak oceny dla tej pozycji",
  setBestLineupDevBetterOtherSectorLabel: "Lepszy w innym sektorze",
  setBestLineupDevTiedOtherSectorLabel: "Remis z innym sektorem",
  setBestLineupDevAlreadyUsedLabel: "Już użyty",
  setBestLineupDevNonTraineeTraceTitle: "Ślad przydziałów nietrenowanych",
  setBestLineupDevSelectedReasonLabel: "Wybrany, bo",
  setBestLineupDevRankingLabel: "Ranking dostępnych zawodników",
  setBestLineupDevRankLabel: "Pozycja",
  setBestLineupDevSlotRatingLabel: "Ocena pozycji",
  setBestLineupDevSkillComboLabel: "Kombinacja umiejętności",
  setBestLineupDevOverallLabel: "Ogółem",
  setBestLineupDevBestOtherRowLabel: "Najlepszy inny rząd",
  setBestLineupDevRowFitLabel: "Dopasowanie do rzędu",
  setBestLineupDevReasonBestSlotRating: "Najlepsza ocena pozycji",
  setBestLineupDevReasonBestSkillCombo: "Najlepsza kombinacja umiejętności w dogrywce remisu",
  setBestLineupDevReasonBestForm: "Najlepsza forma w dogrywce remisu",
  setBestLineupDevReasonBestStamina: "Najlepsza kondycja w dogrywce remisu",
  setBestLineupDevReasonBestOverall: "Najlepsza suma ogólna w dogrywce remisu",
  setBestLineupDevReasonYoungestTieBreak: "Najmłodszy w dogrywce remisu",
  setBestLineupDevReasonFirstRowFit: "Pierwszy zawodnik czysto pasujący do tego rzędu",
  setBestLineupDevReasonRandomFallback: "Losowy fallback po braku czystego dopasowania",
  setBestLineupDevReasonTiedOtherSectorFallback: "Fallback wśród zawodników z remisem z innym sektorem",
  setBestLineupDevReasonBetterOtherSectorFallback: "Fallback wśród zawodników lepszych w innym sektorze",
  setBestLineupDevReasonFormFallback: "Fallback formy bez pasującego kandydata",
  setBestLineupDevReasonBestAggregate: "Najlepszy łączny wynik ławki",
  setBestLineupDevReasonAlphabeticalTieBreak: "Alfabetyczny tie-break",
  setBestLineupDevLineupColumn: "Skład",
  setBestLineupDevPotentialTargetsLabel: "Potencjalne cele krycia indywidualnego",
  setBestLineupDevPotentialTargetsNone: "Nie zidentyfikowano",
  setBestLineupDevFinalTargetLabel: "Wybrany cel krycia indywidualnego",
  setBestLineupDevFinalMarkerLabel: "Wybrany kryjacy",
  setBestLineupDevPotentialTargetBadge: "potencjalny cel",
  setBestLineupDevSelectedTargetBadge: "wybrany cel",
  analyzeOpponent: "Analizuj przeciwnika",
  analyzeOpponentTooltip: "Przeanalizuj ostatnie mecze przeciwnika.",
  analyzeOpponentMatchId: "ID meczu",
  analyzeOpponentMatchType: "Typ meczu",
  analyzeOpponentFormationColumn: "Formacja",
  analyzeOpponentTacticColumn: "Taktyka",
  analyzeOpponentAverageRatingsColumn: "Srednie",
  analyzeOpponentAvgDefense: "Sr. Obr",
  analyzeOpponentAvgMidfield: "Sr. Pom",
  analyzeOpponentAvgAttack: "Sr. Atak",
  analyzeOpponentHatstats: "HatStats",
  analyzeOpponentHatstatsBreakdown: "HatStats obr/pom/atak/suma",
  analyzeOpponentAgainstYouMark: "* oznacza mecze przeciwko tobie.",
  analyzeOpponentNeverPlayedUs: "Nigdy nie grali przeciwko nam.",
  analyzeOpponentSummaryPreferredFormation:
    "najczęściej używana formacja w tych meczach to",
  analyzeOpponentSummaryPreferredTactic:
    "Dla tej formacji najczęściej używana taktyka to",
  analyzeOpponentSummaryVsYou: "Gdy grają przeciwko tobie, preferują",
  analyzeOpponentSummaryWith: "z",
  changelog_3_1_0:
    "Optymalizacja seniorów ma teraz dedykowaną nakładkę pomocy z podpowiedziami dla Ostatnich aktualizacji i ustawiania składu przez AI.",
  changelog_3_2_0:
    "Reżim treningowy seniorów można teraz zmieniać bezpośrednio w aplikacji z kontrolą uprawnień i weryfikacją.",
  changelog_3_3_0:
    "Skład seniorów ustawiany przez AI obsługuje teraz tryb Celuj w dogrywkę dla ustawień nastawionych na dodatkowe minuty treningowe.",
  changelog_3_4_0:
    "Watchlista Club Chronicle zawiera teraz wszystkie twoje własne drużyny seniorów z managercompendium z oznaczeniem męska/żeńska.",
  changelog_3_5_0:
    "Optymalizacja seniorów obsługuje teraz wiele drużyn seniorów z selektorem drużyny z oznaczeniem płci i stanem zapisywanym osobno dla każdej drużyny.",
  changelog_3_6_0:
    "Optymalizacja juniorów dodaje teraz łączony tryb odkrywania bieżącej wartości głównej gwiazdy i maksymalnej wartości drugorzędnej innego zawodnika.",
  clubChronicleRefreshTeamAttitudeTooltip: "Refresh team attitude data.",
  clubChronicleRefreshStatusMatchLineupsProgress:
    "Match lineups {completed}/{total} (team: {team})",
  clubChronicleFormationsAnalyzedDateTimeColumn: "Data/godzina",
  clubChronicleFormationsAnalyzedMatchIdColumn: "ID meczu",
  clubChronicleFormationsAnalyzedMatchTypeColumn: "Typ meczu",
  clubChronicleFormationsAnalyzedFormationColumn: "Formacja",
  clubChronicleFormationsAnalyzedTacticColumn: "Taktyka",
  clubChronicleHelpBulletTeamAttitude:
    "Team Attitude: reuses the most common formation, compares same-formation league midfield ratings with separate home and away baselines, and flags likely PIC, MOTS, or normal matches. Potential labels use a league-only baseline squad from same-formation league matches near the venue-matched normal midfield level, within +/-1 first and +/-2 only if fewer than three league matches qualify.",
  clubChronicleHelpBulletTsi:
    "TSI: laczne TSI zespolu i TSI top 11. Kliknij wiersz, aby zobaczyc sortowalne szczegoly zawodnikow z indeksem, wiekiem (lata+dni), TSI oraz zapisana historia ocen forma 7 z emoji pogody.",
  clubChronicleHelpBulletWages:
    "Place: laczne place zespolu i place top 11 w EUR. Kliknij wiersz, aby zobaczyc sortowalne szczegoly zawodnikow z indeksem, wiekiem (lata+dni), placa oraz zapisana historia ocen forma 7 z emoji pogody.",
  clubChronicleTeamAttitudePanelTitle: "Team attitude (inferred)",
  clubChronicleTeamAttitudeColumnAttitude: "Inferred attitude",
  clubChronicleTeamAttitudeColumnDate: "Date",
  clubChronicleTeamAttitudeDetailsTitle: "Team attitude",
  clubChronicleTeamAttitudeDetailsEmpty: "No analyzed matches available.",
  clubChronicleTeamAttitudeMatchDateColumn: "Mecz",
  clubChronicleTeamAttitudeMatchTypeColumn: "Match type",
  clubChronicleTeamAttitudeHatStatsColumn: "HatStats",
  clubChronicleTeamAttitudeMatchAttitudeColumn: "Wywnioskowane nastawienie",
  clubChronicleTeamAttitudeMatchTacticColumn: "Taktyka",
  clubChronicleTeamAttitudeMidfieldColumn: "Midfield",
  clubChronicleTeamAttitudeLineupColumn: "Lineup set",
  clubChronicleTeamAttitudeBaselineUnionColumn: "Baseline union",
  clubChronicleTeamAttitudeOverlapColumn: "Overlap",
  clubChronicleTeamAttitudeDebugChosenFormationLabel: "Chosen formation",
  clubChronicleTeamAttitudeDebugBaselineValuesLabel: "All midfield values",
    clubChronicleTeamAttitudeDebugInitialBaselineLabel: "Initial baseline",
    clubChronicleTeamAttitudeDebugInitialThresholdLabel: "Initial threshold",
    clubChronicleTeamAttitudeDebugInitialNormalValuesLabel: "Initial normal values",
    clubChronicleTeamAttitudeDebugFinalBaselineValuesLabel: "Final baseline values",
    clubChronicleTeamAttitudeDebugFinalBaselineLabel: "Final baseline",
    clubChronicleTeamAttitudeDebugFinalThresholdLabel: "Final threshold",
  clubChronicleTeamAttitudeNoDetection: "No PIC/MOTS detected",
  clubChronicleTeamAttitudePic: "PIC",
  clubChronicleTeamAttitudeMots: "MOTS",
  clubChronicleTeamAttitudeNormal: "Normal",
  clubChronicleTeamAttitudePotentialPic: "Potentially PIC",
  clubChronicleTeamAttitudePotentialMots: "Potentially MOTS",
  clubChronicleDetailModeUser: "Tryb uzytkownika",
  clubChronicleDetailModeDev: "Tryb deweloperski",
  clubChronicleTeamAttitudeDisclaimer:
    "Te wartosci sa wywnioskowane i nie zawsze musza byc dokladne. Druzyny, ktore regularnie graja PIC, a potem zagraja normalnie, moga wygladac jak MOTS, a druzyny, ktore regularnie graja MOTS, a potem zagraja normalnie, moga wygladac jak PIC.",
  clubChronicleTeamAttitudeDetailsDisclaimer:
    "Wywnioskowane nastawienie to heurystyczna ocena oparta na odchyleniach ratingu pomocy. Ta tabela pokazuje mecze uzyte do wnioskowania: mecze rozegrane najdominujaca formacja ({formation}) oraz ukladem zawodnikow reprezentatywnym dla skladu ligowego.",
  clubChroniclePlayingPositionColumn: "Poz. gry",
  clubChronicleMainSkillEstimationColumn: "Szac. glownej umiejetnosci¹",
  clubChronicleMainSkillEstimationFootnote:
    "¹ Szacowanie glownej umiejetnosci jest tylko przyblizone.",
  clubChronicleMainSkillEstimationTooOld: "Zawodnik zbyt stary",
  clubChronicleForm7RatingColumn: "Ocena forma 7",
  clubChronicleManMarkerColumn: "MM?",
  clubChronicleManMarkerTooltip:
    "Wskazuje, czy zawodnik byl uzywany do krycia indywidualnego.",
  clubChronicleForm7RatingInfoLabel: "O ocenie forma 7",
  clubChronicleForm7RatingInfoTooltip:
    "Pokazuje koncowe oceny w gwiazdkach z meczow, w ktorych zawodnik mial lub ma obecnie forme 7. Pomaga to oszacowac ustandaryzowana gwiazdkowa wydajnosc zawodnikow.",
  clubChronicleWeatherRain: "Deszcz",
  clubChronicleWeatherOvercast: "Pochmurno",
  clubChronicleWeatherPartiallyCloudy: "Czesciowe zachmurzenie",
  clubChronicleWeatherSunny: "Slonecznie",
  clubChroniclePlayerFormColumn: "Forma",
  clubChroniclePlayerStaminaColumn: "Kondycja",
  clubChroniclePlayerExperienceColumn: "Dosw.",
  clubChroniclePlayerLeadershipColumn: "Przywodztwo",
  clubChroniclePlayerLoyaltyColumn: "Lojalnosc",
  seniorHelpTitle: "Przewodnik optymalizacji seniorów",
  seniorHelpIntro:
    "Ten widok pomaga śledzić istotne zmiany w kadrze seniorów i szybciej ustawiać składy meczowe.",
  seniorHelpCalloutUpdates:
    "Ostatnie aktualizacje pokazują tylko zmiany wykryte w zapisanych porównaniach odświeżeń.",
  seniorHelpCalloutSetLineupAi:
    "Ustaw skład przez AI otwiera cztery tryby ustawiania składu dla tego meczu.",
  seniorHelpCalloutTrainingRegimen:
    "To menu rozwijane pozwala bezpośrednio zmienić reżim treningowy seniorów.",
  seniorHelpCalloutAnalyzeOpponent:
    "Analizuj przeciwnika sprawdza ostatnie formacje, taktyki i trendy ocen rywala.",
  seniorHelpBulletLatestUpdates:
    "Nowe porównanie zapisywane jest tylko wtedy, gdy odświeżenie wykryje realne zmiany (np. nowy zawodnik, zmiany ocen/umiejętności, kontuzje, kartki, forma, kondycja lub cechy).",
  seniorHelpBulletAiOverview:
    "Ustaw skład przez AI dobiera najbardziej efektywny skład na podstawie dostępnych danych Hattrick, w tym tryby uwzględniające trening, ignorujące trening, pod dogrywkę i pod stałą formację.",
  seniorHelpBulletAiTrainingAware:
    "Tryb uwzględniający trening respektuje aktualny reżim treningowy i priorytetyzuje składy pokrywające odpowiednie sloty treningowe.",
  seniorHelpBulletAiIgnoreTraining:
    "Tryb ignorujący trening optymalizuje skuteczność meczową bez ograniczeń slotów treningowych, zarówno dla wszystkich formacji, jak i tylko dla formacji z doświadczeniem treningowym powyżej 3.",
  seniorHelpBulletAiMatchTypes:
    "Użyj opcji Celuj w dogrywkę, jeśli chcesz ustawienia pod dodatkowe minuty treningowe w dogrywce, a Optymalizuj według formacji, jeśli chcesz zablokować kształt i pozwolić Alchemy wybrać najlepszy skład.",
  seniorHelpBulletTrainingRegimen:
    "Reżim treningowy seniorów można zmienić bezpośrednio w aplikacji z poziomu rozwijanego menu składu.",
  seniorHelpBulletAnalyzeOpponent:
    "Analizuj przeciwnika podsumowuje ostatnie wzorce, aby wspierać decyzje AI o składzie.",
  analyzeOpponentStillInCup: "nadal w pucharze",
  analyzeOpponentNotInCup: "poza pucharem",
  loadLineupUnavailable: "Brak zapisanego składu",
  loadLineupActive: "Wczytany skład",
  loadLineupError: "Błąd wczytywania składu",
  loadLineupTooltip: "Wczytaj zapisany skład z Hattrick dla tego meczu.",
  submitOrders: "Wyślij skład",
  submitOrdersPending: "Wysyłanie…",
  submitOrdersSuccess: "Wysłano",
  submitOrdersSuccessOverwritten:
    "Wysłano. Poprzedni skład został nadpisany.",
  submitOrdersPreviousLineupOverwritten:
    "Poprzedni skład został nadpisany.",
  submitOrdersError: "Błąd wysyłki",
  submitOrdersOverwriteWarningTitle:
    "Istniejący skład zostanie nadpisany",
  submitOrdersOverwriteWarningBody:
    "Ten mecz ma już wysłany skład. Jeśli kontynuujesz, poprzedni skład dla tego meczu zostanie nadpisany.",
  submitOrdersResponse: "Odpowiedź",
  submitOrdersUpdated: "Zaktualizowano",
  submitOrdersMinPlayers: "Skład musi mieć co najmniej 9 zawodników",
  submitOrdersMaxPlayers: "Skład nie może przekraczać 11 zawodników",
  seniorSubmitOrdersOtherMatchTooltip:
    "Nie mozna wyslac tego skladu, poniewaz zostal przygotowany na inny mecz: {{home}} vs {{away}} dnia {{datetime}}.",
  seniorSubmitDisclaimerTitle: "⚠️ Zastrzeżenie po wysłaniu składu",
  seniorSubmitDisclaimerIntro: "Sprawdź proszę poniższe punkty:",
  seniorSubmitDisclaimerManMarkingSummary:
    "Krycie indywidualne {{target}} przez {{marker}} zostanie wysłane.",
  seniorSubmitDisclaimerManMarkingTargetChosen:
    "{{target}} wybrany jako cel krycia indywidualnego",
  seniorSubmitDisclaimerManMarkingMarkerChosen:
    "{{marker}} wybrany jako kryjacy",
  seniorSubmitDisclaimerManMarkingTargetMissing:
    "nie zidentyfikowano odpowiedniego celu krycia indywidualnego",
  seniorSubmitDisclaimerManMarkingMarkerMissing:
    "nie zidentyfikowano odpowiedniego kryjacego",
  seniorSubmitDisclaimerOrdersTitle: "Planowane zmiany i zamiany pozycji",
  seniorSubmitDisclaimerOrdersNone: "Brak planowanych zmian lub zamian pozycji.",
  seniorSubmitDisclaimerPenaltyOrderTitle: "Kolejność wykonawców rzutów karnych",
  seniorSubmitDisclaimerSetPiecesTitle: "Wyznaczony wykonawca stałych fragmentów",
  seniorSubmitDisclaimerBulletBestEffort:
    "Na podstawie informacji dostarczonych przez Hattrick jest to najbardziej efektywny skład, jaki AI mogła wygenerować.",
  seniorSubmitDisclaimerBulletNoResponsibility:
    "To narzędzie nie ponosi odpowiedzialności za powodzenie tego składu.",
  seniorSubmitDisclaimerBulletFineTune:
    "Ostateczna odpowiedzialność za dopracowanie składu pozostaje po Twojej stronie.",
  seniorSubmitDisclaimerBulletResubmit:
    "Ustawienie zawodników, formację i taktykę możesz tutaj dopracować i ponownie wysłać przyciskiem Wyślij skład.",
  seniorSubmitDisclaimerBulletKickers:
    "Wykonawcy rzutów karnych są ustawiani automatycznie malejąco według umiejętności stałych fragmentów.",
  seniorSubmitDisclaimerBulletOrdersInHattrick:
    "Jeśli potrzebne są polecenia meczowe, należy ustawić je bezpośrednio w Hattrick.",
  seniorSubmitDisclaimerBulletVerify:
    "Przed pierwszym gwizdkiem sprawdź dostępność, kontuzje i założenia taktyczne.",
  seniorExtraTimeSubmitDisclaimerIntro:
    "Polecenia dla składu ustawionego pod dogrywkę zostały wysłane dla reżimu treningowego {{training}}.",
  seniorExtraTimeSubmitDisclaimerSwap:
    "Trenowani zawodnicy {{trainees}} będą zamieniać się pozycjami, aby maksymalizować trening w dogrywce, jeśli mecz po 90 minutach będzie remisowy.",
  seniorExtraTimeSubmitDisclaimerPressing:
    "Aby zwiększyć szansę na remis, użyto taktyki Pressing.",
  seniorExtraTimeSubmitDisclaimerSetPieces:
    "Stałe fragmenty wykonuje zawodnik z najsłabszym poziomem stałych fragmentów.",
  seniorExtraTimeSubmitDisclaimerPenalties:
    "Kolejność wykonawców karnych została ustawiona tak, aby pierwszy strzelał zawodnik z najmniejszą szansą na zdobycie gola.",
  seniorExtraTimeSubmitDisclaimerBehaviors:
    "Gdzie było to możliwe, zawodnicy zostali ustawieni defensywnie.",
  seniorExtraTimeSubmitDisclaimerSubstitutionsTitle:
    "Planowane zmiany i zamiany pozycji",
  seniorExtraTimeSubmitDisclaimerSwapLine:
    "{{minute}}': {{playerIn}} zamienia się pozycją z {{playerOut}}.",
  seniorExtraTimeSubmitDisclaimerReplaceLine:
    "{{minute}}': {{playerIn}} zmienia {{playerOut}}.",
  seniorExtraTimeSubmitDisclaimerTrainingTitle:
    "Podsumowanie treningu według scenariusza",
  seniorExtraTimeSubmitDisclaimerTrainingIntro:
    "Poniższe efektywne minuty treningowe są wyliczone dla tego konkretnego wysłanego składu. Scenariusz 2 zakłada dogrywkę.",
  seniorExtraTimeSubmitDisclaimerTrainingPlayerHeader: "Trenowany",
  seniorExtraTimeSubmitDisclaimerTrainingScenario90Header:
    "Minuty treningu bez dogrywki",
  seniorExtraTimeSubmitDisclaimerTrainingScenario120Header:
    "Minuty treningu z dogrywką",
  seniorExtraTimeSubmitDisclaimerFurtherTitle:
    "Dalsze informacje i zastrzeżenie",
  submitOrdersTooltip: "Wyślij bieżący skład do Hattrick dla tego meczu.",
  confirmSubmitOrders: "Wysłać bieżący skład na ten mecz?",
  confirmCancel: "Anuluj",
  confirmSubmit: "Potwierdź",
  lineupTitle: "Skład",
  lineupEmptySlotRecommendationsHint:
    "Kliknij puste miejsca, aby zobaczyć rekomendacje zawodników",
  clearSlot: "Wyczyść",
  lastUpdated: "Ostatnia aktualizacja",
  yearsLabel: "lat",
  daysLabel: "dni",
  ageYearsShort: "l",
  ageDaysShort: "d",
  ageAtPromotionLabel: "wiek przy awansie",
  unlockedLabel: "Odblokowane",
  promotableNow: "Może awansować teraz",
  promotableNowShort: "TERAZ",
  promotableIn: "Awans za",
  youthTeamLabel: "Drużyna juniorów",
  seniorTeamLabel: "Drużyna seniorów",
  arrivedLabel: "Dołączył",
  specialtyLabel: "Specjalność",
  specialtyNone: "Brak",
  specialtyTechnical: "Techniczny",
  specialtyQuick: "Szybki",
  specialtyPowerful: "Silny",
  specialtyUnpredictable: "Nieprzewidywalny",
  specialtyHeadSpecialist: "Gra głową",
  specialtyResilient: "Odporny",
  specialtySupport: "Wsparcie",
  motherClubBonusTooltip: "Bonus klubu macierzystego",
  skillBonusMotherClubTooltip: "Bonus klubu macierzystego",
  skillBonusLoyaltyTooltip: "Bonus lojalności",
  seniorSkillLevelLabels:
    "disastrous|wretched|poor|weak|inadequate|passable|solid|excellent|formidable|outstanding|brilliant|magnificent|world class|supernatural|titanic|extra-terrestrial|mythical|magical|utopian|divine",
  seniorAgreeabilityLabels:
    "niemila|kontrowersyjna|przyjemna|sympatyczna|popularna|lubiana",
  seniorAggressivenessLabels:
    "spokojna|opanowana|zrownowazona|temperamentalna|ognista|niestabilna",
  seniorHonestyLabels:
    "nieslawna|nieuczciwa|uczciwa|prawa|sprawiedliwa|swieta",
  seniorPersonalitySentence:
    "To {{agreeabilityLabel}} osoba ({{agreeabilityValue}}), ktora jest {{aggressivenessLabel}} ({{aggressivenessValue}}) i {{honestyLabel}} ({{honestyValue}}).",
  seniorTraitsSentenceExperienceLeadership:
    "Ma {{experienceLevel}} ({{experienceValue}}) doświadczenia i {{leadershipLevel}} ({{leadershipValue}}) przywództwa.",
  seniorTraitsSentenceLoyalty:
    "Ma {{loyaltyLevel}} ({{loyaltyValue}}) lojalności.",
  seniorWageLabel: "Pensja",
  seniorMlPredictedWageLabel: "Prognoza ML",
  seniorMlPredictionDiffLabel: "rozn.",
  seniorWageForeignExtraNote: "zawiera 20% dodatku za gracza zagranicznego",
  seniorFoxtrickMetricsTitle: "Wartosci FoxTrick",
  seniorFoxtrickEditSkillsLabel: "Edytuj umiejetnosci, wiek, pensje, TSI",
  seniorFoxtrickSimulationTooltip:
    "Wlacz, aby edytowac umiejetnosci, wiek, pensje i TSI oraz symulowac wartosci FoxTrick. Wylacz, aby wrocic do prawdziwych wartosci.",
  seniorFoxtrickSimulationPremiumTooltip:
    "Kup licencje premium HT Alchemy, aby edytowac umiejetnosci, wiek, pensje i TSI w szczegolach seniora.",
  seniorFoxtrickSimulationWarning:
    "Wartosci umiejetnosci, wieku, pensji lub TSI zostaly zmienione recznie i nie odzwierciedlaja juz prawdziwego zawodnika.",
  seniorFoxtrickSimulationAgeYearsLabel: "Wiek lata",
  seniorFoxtrickSimulationAgeDaysLabel: "Wiek dni",
  seniorFoxtrickSimulationWageLabel: "Pensja (EUR)",
  seniorHtmsAbilityLabel: "Umiejetnosc HTMS",
  seniorHtmsPotentialLabel: "Potencjal HTMS",
  seniorPsicoTsiMainSkillLabel: "Glowna umiejetnosc",
  seniorPsicoTsiTsiPredictionLabel: "Prognoza na podstawie TSI",
  seniorPsicoTsiWagePredictionLabel: "Prognoza na podstawie pensji",
  seniorPsicoTsiFormSublevelsLabel: "Podpoziomy formy",
  seniorPsicoTsiSecondariesSublevelsLabel: "Podpoziomy umiejetnosci pobocznych",
  seniorPsicoTsiPredictionLabel: "Prognoza",
  seniorPsicoTsiHighLabel: "Wysokie",
  seniorPsicoTsiAverageLabel: "Srednie",
  seniorPsicoTsiLowLabel: "Niskie",
  seniorPsicoTsiUndefinedMainSkillWarning:
    "Dwie glowne umiejetnosci sa rowne; prognoza moze byc mniej wiarygodna.",
  seniorPsicoTsiWageUnavailableWarning:
    "Prognoza z pensji nie jest dostepna dla tego zawodnika.",
  seniorPsicoTsiLowSublevelsWarning:
    "Blisko awansu umiejetnosci lub bardzo niskie podpoziomy formy/pobocznych.",
  seniorPsicoTsiHighSublevelsWarning:
    "Blisko awansu umiejetnosci lub bardzo wysokie podpoziomy formy/pobocznych.",
  hiddenSpecialtyTooltip: "Ukryta specjalność wykryta z wydarzeń meczowych",
  hiddenSpecialtyTooltipLinkHint: "Kliknij, aby otworzyć mecz, w którym ją odkryto",
  skillsLabel: "Umiejętności",
  skillMaxedTooltip: "Umiejętność na maksimum",
  unknownLabel: "nieznane",
  unknownShort: "?",
  potentialLabel: "potencjał",
  lastMatchPositionLabel: "Pozycja w ostatnim meczu",
  lastMatchRatingLabel: "Ocena w ostatnim meczu",
  playerIdLabel: "Identyfikator zawodnika",
  cardStatusLabel: "Status kartek",
  playerLinkLabel: "Zobacz w Hattrick",
  copyPlayerIdLabel: "Kopiuj identyfikator zawodnika",
  notificationPlayerIdCopied: "Identyfikator zawodnika skopiowany",
  dragPlayerHint: "Przeciągnij, aby przenieść",
  youthDragToLineupHint: "Przeciągnij do składu",
  homeLabel: "Gospodarz",
  awayLabel: "Gość",
  unknownDate: "Nieznana data",
  connectLabel: "Połącz Hattrick",
  mobileConnectLabel: "Połącz",
  connectedLabel: "Połączono",
  connectHint: "Użyj przycisku Połącz w prawym górnym rogu, aby zalogować się ponownie.",
  disconnectLabel: "Rozłącz",
  authExpiredTitle: "Sesja wygasła",
  authExpiredBody: "Autoryzacja Hattrick wygasła lub została cofnięta. Połącz ponownie, aby kontynuować.",
  authExpiredAction: "Połącz ponownie",
  authExpiredDismiss: "Zamknij",
  scopeReconnectTitle: "Wymagane uprawnienia",
  scopeReconnectBody: "Z powodu nowo dodanych funkcji uprawnienia tokenu są niewystarczające. Połącz ponownie, aby pobrać wymagane zakresy.",
  scopeReconnectAction: "Połącz ponownie",
  oauthErrorClientExplanation: "Hattrick OAuth/CHPP odrzucił żądanie (4xx). Zwykle to problem z autoryzacją lub walidacją.",
  oauthErrorServerExplanation: "Hattrick OAuth/CHPP zwrócił błąd serwera (5xx). To problem po stronie usługi zewnętrznej.",
  oauthErrorUnknownExplanation: "Hattrick OAuth/CHPP zwrócił nieoczekiwany błąd podczas odświeżania danych.",
  oauthErrorRecoveryHint: "Spróbuj rozłączyć dostęp i połączyć ponownie. Jeśli to nie pomoże, skontaktuj się ze wsparciem Hattrick.",
  notificationPlayersRefreshed: "Zawodnicy odświeżeni",
  notificationSeniorPlayersRefreshed: "Seniorzy odświeżeni",
  notificationYouthPlayerDetailsPartialRefresh:
    "Nie udało się odświeżyć części szczegółów juniorów ({{count}}/{{total}}).",
  notificationDebugSeniorMlEncountered:
    "Debug: senior ML napotkal {{count}} zawodnikow z rynku transferowego",
  notificationDebugSeniorMlDedup:
    "Debug: senior ML dodane {{added}}, zduplikowane {{deduped}}, nieudane {{failed}}",
  notificationMatchesRefreshed: "Mecze odświeżone",
  notificationMatchesRefreshFailed: "Nie udało się odświeżyć meczów",
  notificationSeniorIgnoreTrainingNoTrainedFormations:
    "Nie znaleziono formacji z doświadczeniem treningowym powyżej 3. Następuje powrót do wszystkich formacji.",
  notificationSeniorTrainingRegimenChanged:
    "Reżim treningowy drużyny seniorów zmieniono na {{training}}",
  notificationSeniorRatingsMatrixWiped: "Wyczyszczono macierz ocen seniorów.",
  notificationSeniorRatingsBootstrapComplete:
    "Bootstrap ocen seniorów zakończony.",
  notificationLineupLoaded: "Wczytano skład:",
  notificationLineupSubmitted: "Wysłano skład:",
  notificationLineupSubmittedOverwritten:
    "Wysłano. Poprzedni skład został nadpisany dla",
  notificationSortBy: "Sortowanie:",
  notificationSortDirection: "Kierunek sortowania:",
  notificationPlayerSelected: "Wybrano zawodnika:",
  notificationStarSet: "Ustawiono gwiazdę:",
  notificationStarCleared: "Usunięto gwiazdę",
  notificationStaleRefresh: "Uruchomiono odświeżanie z powodu przestarzałych danych.",
  notificationReauthRequired: "Odświeżanie przerwane: wymagana ponowna autoryzacja",
  autoSelectTitle: "Automatycznie wybierz gwiazdę i trening",
  mobileHomeLabel: "Start",
  mobileYouthMenuToggleLabel: "Otwórz menu juniorów",
  mobileSeniorMenuToggleLabel: "Otwórz menu seniorów",
  mobilePreviousPanelLabel: "Poprzedni panel",
  mobileNextPanelLabel: "Następny panel",
  mobileYouthRootTitle: "Optymalizacja składu juniorów",
  mobileYouthRootPrompt:
    "Użyj pływającego menu, aby otworzyć szczegóły zawodnika, macierze lub optymalizator składu.",
  mobileYouthBackLabel: "Wstecz",
  mobileYouthBackToPlayerList: "Powrót do listy zawodników",
  mobileYouthLandscapeHint:
    "Obróć ekran poziomo, aby zobaczyć pełną macierz.",
  mobileChronicleLandscapeHint:
    "Obróć ekran poziomo, aby zobaczyć szerszy widok tabeli.",
  clubChronicleNoTeams:
    "Obecnie dla tej karty nie sa sledzone zadne druzyny. Dodaj druzyny do sledzenia przez watchliste.",
  clubChronicleNoTeamsMobileHint:
    "Na mobile watchlista znajduje sie w plywajacym menu.",
  mobileYouthLineupPickerTitle: "Wybierz zawodnika",
  mobileYouthLineupPickerEmpty:
    "Brak zawodników dostępnych dla tego miejsca.",
  mobileYouthViewComingSoon:
    "Ten mobilny widok juniorów nie jest jeszcze gotowy.",
  mobileSeniorViewComingSoon:
    "Ten mobilny widok seniorów nie jest jeszcze gotowy.",
  trainingTitle: "Skoncentrowany trening umiejętności",
  trainingSectionFocused: "Skoncentrowany trening umiejętności",
  trainingSectionExtended: "Rozszerzony trening umiejętności",
  trainingSectionCombined: "Łączony trening umiejętności",
  trainingRegimenLabel: "Reżim treningowy",
  trainingSetButtonLabel: "Ustaw",
  trainingSetButtonTooltip: "Ustaw jako nowy reżim treningowy",
  youthTrainingChppLimitInfoLabel: "Ograniczenie CHPP treningu juniorów",
  youthTrainingChppLimitTooltip:
    "CHPP nie pozwala importować reżimów treningowych juniorów z Hattricka ani ustawiać ich w Hattricku. Jeśli chcesz, aby to się zmieniło, wyślij prośbę o funkcję do Hattricka.",
  primaryTrainingLabel: "Główny",
  secondaryTrainingLabel: "Drugorzędny",
  trainingUnset: "—",
  trainingKeeper: "Bronienie",
  trainingDefending: "Defensywa",
  trainingPlaymaking: "Rozgrywanie",
  trainingWinger: "Dośrodkowania",
  trainingPassing: "Podania",
  trainingScoring: "Skuteczność",
  trainingSetPieces: "St. fragmenty",
  trainingDefendingDefendersMidfielders:
    "Defensywa (Bramkarz, Obrońcy + Wszyscy Pomocnicy)",
  trainingWingerWingerAttackers: "Skrzydła (Skrzydłowi + Napastnicy)",
  trainingPassingDefendersMidfielders: "Podania (Obrońcy + Wszyscy Pomocnicy)",
  trainingSlotPrimary: "Główny",
  trainingSlotSecondary: "Drugorzędny",
  trainingSlotBoth: "Gł/dr",
  starPlayerLabel: "Ustaw gwiazdę",
  tacticLabel: "Taktyka",
  tacticNormal: "Normalna",
  tacticPressing: "Pressing",
  tacticCounterAttacks: "Kontrataki",
  tacticAttackMiddle: "Atak środkiem",
  tacticAttackWings: "Atak skrzydłami",
  tacticPlayCreatively: "Gra kreatywna",
  tacticLongShots: "Strzały z dystansu",
  closeLabel: "Zamknij",
  yesLabel: "Tak",
  noLabel: "Nie",
  debugYouthSeMatchIdLabel: "Identyfikator meczu juniorów",
  debugYouthSeFetchButton: "Pobierz ZW",
  debugYouthSeFetchHint:
    "Loguje w konsoli obserwowane wydarzenia specjalne: identyfikator wydarzenia, nazwy obiektu/podmiotu i adres URL meczu.",
  clubChronicleUpdatesButton: "Najnowsze aktualizacje",
  clubChronicleColumnCup: "Puchar",
  clubChronicleCupNone: "Brak",
  clubChronicleLeagueSectionTitle: "Forma ligowa i puchar",
  clubChronicleFieldCup: "Puchar",
  clubChroniclePanelVisibilityTooltip: "Zarzadzaj widocznymi panelami",
  clubChroniclePanelVisibilityTitle: "Widoczne panele",
  clubChroniclePanelVisibilityHint:
    "Wybierz, ktore panele Club Chronicle sa pokazywane na desktopie.",
  clubChroniclePanelVisibilityShowAll: "Pokaz wszystkie panele",
  clubChroniclePanelHideTooltip: "Ukryj panel",
  clubChroniclePanelVisibilityAllHidden:
    "Wszystkie panele sa ukryte. Uzyj przycisku widocznosci paneli, aby pokazac je ponownie.",
  clubChronicleRefreshButton: "Odśwież",
  clubChronicleRefreshPowerRatingsTooltip: "Odśwież dane power ratings.",
  clubChroniclePowerRatingsPanelTitle: "Power ratings",
  clubChroniclePowerRatingsDetailsTitle: "Power ratings",
  clubChroniclePowerRatingsColumnValue: "Power rating",
  clubChroniclePowerRatingsColumnGlobalRanking: "Ranking globalny",
  clubChroniclePowerRatingsColumnLeagueRanking: "Ranking ligi",
  clubChroniclePowerRatingsColumnRegionRanking: "Ranking regionu",
  clubChronicleRefreshOngoingMatchesTooltip:
    "Odśwież trwające mecze i wyniki.",
  clubChronicleRefreshStatusOngoingMatches: "Pobieranie trwających meczów…",
  clubChronicleMatchTypeTournament: "Mecz turniejowy",
  clubChronicleOngoingMatchesPanelTitle: "Trwające mecze",
  clubChronicleOngoingMatchesEnableLabel: "Włącz",
  clubChronicleOngoingMatchesIncludeTournamentsLabel: "Mecze turniejowe",
  clubChronicleOngoingMatchesColumnMatch: "Mecz",
  clubChronicleOngoingMatchesColumnScore: "Wynik",
  clubChronicleOngoingMatchesNone: "Brak trwającego meczu.",
  clubChronicleOngoingMatchesEventsTitle: "Wydarzenia meczu",
  clubChronicleOngoingMatchesEventsEmpty: "Brak dostępnych wydarzeń meczu.",
  clubChronicleOngoingMatchesDisabled:
    "Śledzenie trwających meczów jest wyłączone. Mecze nie będą pobierane ani wyświetlane.",
  clubChronicleOngoingMatchesDisclaimer:
    "Po włączeniu tej funkcji zaakceptowane trwające mecze śledzonych drużyn zostaną dodane do Hattrick Live. Wyniki nie aktualizują się automatycznie; użyj przycisku odświeżania w tym panelu. Kliknij wynik, aby zobaczyć wydarzenia meczu. Jeśli w Hattrick Live śledzonych jest zbyt wiele meczów, ta funkcja może działać niestabilnie; kontroluj liczbę śledzonych meczów i usuwaj zakończone mecze przyciskiem powyżej.",
  clubChronicleRemoveFinishedLiveMatchesTooltip:
    "Usuń wszystkie zakończone mecze z Hattrick Live.",
  clubChronicleFinishedLiveMatchesRemoved:
    "{{count}} zakończone mecze usunięte z Hattrick Live",
  themeSwitchDark: "Przełącz na tryb ciemny",
  optimizeLineupTitle: "Optymalizuj skład",
  optimizeMenuStar: "Optymalizuj wokół {{player}}",
  optimizeMenuRatings: "Optymalizuj wg ocen",
  optimizeMenuRevealPrimaryCurrent:
    "Odkryj bieżącą wartość umiejętności {{trainingLower}} zawodnika {{player}}",
  optimizeMenuRevealSecondaryMax:
    "Odkryj maksymalną wartość umiejętności {{trainingLower}} zawodnika {{player}}",
  optimizeMenuRevealPrimaryCurrentAndSecondaryMax:
    "Odkryj bieżącą wartość {{trainingLower}} zawodnika {{player}} oraz maksymalną wartość {{secondaryTrainingLower}} zawodnika {{secondaryPlayer}}",
  optimizeRevealPrimaryCurrentKnown:
    "Odkrywanie bieżącej wartości głównej niedostępne: bieżąca wartość głównej umiejętności gwiazdy jest już znana.",
  optimizeRevealPrimaryCurrentKnownTooltip:
    "Odkrywanie niedostępne: bieżąca wartość umiejętności {{training}} zawodnika {{player}} jest już znana.",
  optimizeRevealPrimaryCurrentUnavailable:
    "Odkrywanie bieżącej wartości głównej niedostępne. Wybierz gwiazdę i główny trening.",
  optimizeRevealSecondaryMaxKnown:
    "Odkrywanie maksymalnej wartości drugorzędnej niedostępne: maksymalna wartość drugorzędnej umiejętności gwiazdy jest już znana.",
  optimizeRevealSecondaryMaxKnownTooltip:
    "Odkrywanie niedostępne: maksymalna wartość umiejętności {{training}} zawodnika {{player}} jest już znana.",
  optimizeRevealSecondaryMaxUnavailable:
    "Odkrywanie maksymalnej wartości drugorzędnej niedostępne. Wybierz gwiazdę i trening drugorzędny.",
  optimizeRevealPrimaryCurrentAndSecondaryMaxUnavailable:
    "Łączone odkrywanie niedostępne. Wybierz gwiazdę, oba treningi i prawidłowy cel drugorzędny.",
  optimizeRevealTargetPlaceholder: "Wybierz cel drugorzędny",
  optimizeRevealCombinedButton: "Zastosuj łączone odkrywanie",
  optimizeRatingsUnavailable:
    "Optymalizacja wg ocen niedostępna. Wybierz gwiazdę oraz oba treningi.",
  optimizeRatingsStarMaxed:
    "Optymalizacja wg ocen niedostępna: główna i drugorzędna umiejętność gwiazdy mają już maksimum.",
  optimizeLineupNeedsStar: "Wybierz gwiazdę, aby optymalizować",
  optimizeLineupNeedsTraining: "Wybierz oba treningi, aby optymalizować",
  optimizeLineupNeedsKnownSkills:
    "Do optymalizacji potrzebne są znane wartości bieżące i maksymalne umiejętności",
  matchType100: "Liga juniorów",
  randomizeLineup: "Losowy skład",
  resetLineup: "Resetuj skład",
  permissionsLabel: "Uprawnienia:",
  disconnectTitle: "Rozłącz i cofnij dostęp",
  skillKeeper: "Bronienie",
  skillDefending: "Defensywa",
  skillPlaymaking: "Rozgrywanie",
  skillWinger: "Dośrodkowania",
  skillPassing: "Podania",
  skillScoring: "Skuteczność",
  skillSetPieces: "St. fragmenty",
  skillKeeperShort: "BR",
  skillDefendingShort: "OBR",
  skillPlaymakingShort: "ROZ",
  skillWingerShort: "SKR",
  skillPassingShort: "POD",
  skillScoringShort: "STR",
  skillSetPiecesShort: "SFG",
  lineupSlotLeftWingBack: "Lewy boczny obrońca",
  lineupSlotRightWingBack: "Prawy boczny obrońca",
  lineupSlotLeftCentralDefender: "Lewy środkowy obrońca",
  lineupSlotCentralDefender: "Środkowy obrońca",
  lineupSlotRightCentralDefender: "Prawy środkowy obrońca",
  lineupSlotLeftWinger: "Lewy skrzydłowy",
  lineupSlotRightWinger: "Prawy skrzydłowy",
  lineupSlotLeftInnerMidfield: "Lewy pomocnik środkowy",
  lineupSlotCentralInnerMidfield: "Środkowy pomocnik",
  lineupSlotRightInnerMidfield: "Prawy pomocnik środkowy",
  lineupSlotLeftForward: "Lewy napastnik",
  lineupSlotCentralForward: "Środkowy napastnik",
  lineupSlotRightForward: "Prawy napastnik",
  lineupSlotBenchKeeper: "Rezerwowy bramkarz",
  lineupSlotBenchCentralDefender: "Rezerwowy środkowy obrońca",
  lineupSlotBenchWingBack: "Rezerwowy boczny obrońca",
  lineupSlotBenchInnerMidfield: "Rezerwowy pomocnik środkowy",
  lineupSlotBenchForward: "Rezerwowy napastnik",
  lineupSlotBenchWinger: "Rezerwowy skrzydłowy",
  lineupSlotBenchExtra: "Dodatkowy rezerwowy",
  benchKeeperLabel: "BR",
  benchDefenderLabel: "SO",
  benchWingBackLabel: "BO",
  benchMidfieldLabel: "PM",
  benchForwardLabel: "N",
  benchWingerLabel: "SKR",
  benchExtraLabel: "REZ",
  brandTitle: "Hattrick Alchemy",
};
